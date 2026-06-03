import os
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncpg

app = FastAPI()

class QueryRequest(BaseModel):
    query: str

# Strict security list to prevent data-modifying operations
FORBIDDEN_KEYWORDS = [
    "DROP", "DELETE", "UPDATE", "INSERT", 
    "ALTER", "TRUNCATE", "GRANT", "REVOKE", 
    "COMMIT", "ROLLBACK", "EXEC", "EXECUTE"
]

@app.post("/api/execute-sql")
async def execute_sql(request: QueryRequest):
    query = request.query.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    # 1. Security Validation: Block data-modifying keywords
    # We use a case-insensitive regex to match whole words to prevent bypasses like 'dRoP'
    query_upper = query.upper()
    for keyword in FORBIDDEN_KEYWORDS:
        if re.search(rf'\b{keyword}\b', query_upper):
            raise HTTPException(
                status_code=403, 
                detail=f"Security Error: Forbidden keyword detected ({keyword}). Only read operations are allowed."
            )

    # 2. To protect against massive data dumps, automatically append LIMIT 100 
    # if a limit isn't already present in the query.
    if not re.search(r'\bLIMIT\b', query_upper):
        if query.endswith(";"):
            query = query[:-1] + " LIMIT 100;"
        else:
            query = query + " LIMIT 100"

    # 3. Connect to Supabase
    database_uri = os.environ.get("SUPABASE_READ_ONLY_URI")
    if not database_uri:
        raise HTTPException(status_code=500, detail="Server configuration error: Database URI missing.")

    try:
        # Establish connection using asyncpg
        conn = await asyncpg.connect(database_uri)
        try:
            # 4. Execute query
            # fetch() returns a list of Record objects
            records = await conn.fetch(query)
            
            # Convert records to a list of dictionaries for JSON serialization
            results = [dict(record) for record in records]
            return results
        finally:
            # Always close the connection
            await conn.close()
    except asyncpg.exceptions.PostgresError as e:
        # 5. Catch SQL syntax errors and return them safely to the frontend
        raise HTTPException(status_code=400, detail=f"SQL Error: {str(e)}")
    except Exception as e:
        # Catch unexpected errors
        raise HTTPException(status_code=500, detail="An internal server error occurred.")
