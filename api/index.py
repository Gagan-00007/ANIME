import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pymongo

app = FastAPI()

class QueryRequest(BaseModel):
    query: str

# Strict security list to prevent data-modifying operations
FORBIDDEN_COMMANDS = {
    "dropdatabase", "drop", "delete", "insert", 
    "update", "renamecollection", "createuser",
    "dropuser", "grantroles", "revokeroles"
}

# Keep a global client to reuse connection pools across warm serverless invocations
client = None

@app.post("/api/execute-sql")
def execute_mongo(request: QueryRequest):
    global client
    query_str = request.query.strip()
    
    if not query_str:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    # Parse the query as JSON
    try:
        command_dict = json.loads(query_str)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

    if not isinstance(command_dict, dict):
        raise HTTPException(status_code=400, detail="Query must be a valid JSON object.")

    # 1. Security Validation: Block data-modifying commands
    for key in command_dict.keys():
        if key.lower() in FORBIDDEN_COMMANDS:
            raise HTTPException(
                status_code=403, 
                detail=f"Security Error: Forbidden command detected ({key}). Only read operations are allowed."
            )

    # 2. To protect against massive data dumps, automatically append limit 100 
    if "find" in command_dict and "limit" not in command_dict:
        command_dict["limit"] = 100

    # 3. Connect to MongoDB
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        raise HTTPException(status_code=500, detail="Server configuration error: MONGODB_URI missing.")

    try:
        # Establish connection (reuses global client if warm)
        if client is None:
            client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        
        db = client.get_default_database()
        
        # 4. Execute the raw MongoDB command synchronously
        result = db.command(command_dict)
        
        # 5. Format the result to fit into the existing frontend table nicely
        if "cursor" in result and "firstBatch" in result["cursor"]:
            formatted_results = result["cursor"]["firstBatch"]
        else:
            formatted_results = [result]
            
        # Convert MongoDB ObjectId to string to prevent JSON serialization errors
        for row in formatted_results:
            if "_id" in row:
                row["_id"] = str(row["_id"])
                
        return formatted_results
        
    except Exception as e:
        # Catch unexpected errors and expose them temporarily for debugging
        raise HTTPException(status_code=500, detail=f"MongoDB Connection or Execution Error: {str(e)}")
