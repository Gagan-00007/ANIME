import os
import json
import pymongo
import psycopg2
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class QueryRequest(BaseModel):
    query: str

# ---------------------------------------------------------
# MONGODB ENDPOINT
# ---------------------------------------------------------
MONGO_FORBIDDEN_COMMANDS = {
    "dropdatabase", "drop", "delete", "insert", 
    "update", "renamecollection", "createuser",
    "dropuser", "grantroles", "revokeroles"
}

mongo_client = None

@app.post("/api/execute-mongo")
def execute_mongo(request: QueryRequest):
    global mongo_client
    query_str = request.query.strip()
    
    if not query_str:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    try:
        command_dict = json.loads(query_str)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

    if not isinstance(command_dict, dict):
        raise HTTPException(status_code=400, detail="Query must be a valid JSON object.")

    for key in command_dict.keys():
        if key.lower() in MONGO_FORBIDDEN_COMMANDS:
            raise HTTPException(
                status_code=403, 
                detail=f"Security Error: Forbidden command detected ({key}). Only read operations are allowed."
            )

    if "find" in command_dict and "limit" not in command_dict:
        command_dict["limit"] = 100

    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        raise HTTPException(status_code=500, detail="Server configuration error: MONGODB_URI missing.")

    try:
        if mongo_client is None:
            mongo_client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        
        db = mongo_client.get_default_database()
        result = db.command(command_dict)
        
        if "cursor" in result and "firstBatch" in result["cursor"]:
            formatted_results = result["cursor"]["firstBatch"]
        else:
            formatted_results = [result]
            
        for row in formatted_results:
            if "_id" in row:
                row["_id"] = str(row["_id"])
                
        return formatted_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB Error: {str(e)}")

# ---------------------------------------------------------
# POSTGRESQL (SUPABASE) ENDPOINT
# ---------------------------------------------------------
SQL_FORBIDDEN_KEYWORDS = {
    "drop", "delete", "insert", "update", "alter", "truncate", "grant", "revoke"
}

@app.post("/api/execute-sql")
def execute_sql(request: QueryRequest):
    query_str = request.query.strip()
    
    if not query_str:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Convert to lowercase and split by whitespace/punctuation to check tokens safely
    tokens = query_str.lower().replace(";", " ").replace("\n", " ").split()
    for token in tokens:
        if token in SQL_FORBIDDEN_KEYWORDS:
            raise HTTPException(status_code=403, detail=f"Security Error: The '{token.upper()}' command is forbidden. Read-only queries only.")
            
    # Add a limit if not present
    if "limit" not in query_str.lower():
        query_str = f"SELECT * FROM ({query_str}) AS subquery LIMIT 100"

    database_uri = os.environ.get("DATABASE_URL")
    if not database_uri:
        raise HTTPException(status_code=500, detail="Server configuration error: DATABASE_URL missing.")

    try:
        # We use psycopg2 directly (synchronously)
        # Note: psycopg2 expects postgresql:// but Supabase provides postgresql://
        # Sometimes connection poolers require SSL modes or parameters, but default usually works
        conn = psycopg2.connect(database_uri, connect_timeout=5)
        conn.autocommit = True
        
        with conn.cursor() as cursor:
            # Handle empty queries (e.g., just comments)
            if not query_str.strip():
                return []
                
            cursor.execute(query_str)
            
            # If the command was a ping/check that doesn't return rows (though we appended a limit, so it usually does)
            if cursor.description is None:
                return [{"status": "success", "message": "Query executed successfully, but returned no data."}]
                
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            result_list = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                result_list.append(row_dict)
                
        conn.close()
        return result_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase Connection Error: {str(e)}")
