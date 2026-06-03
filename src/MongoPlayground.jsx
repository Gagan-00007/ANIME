import React, { useState, useEffect } from 'react';
import './MongoPlayground.css';

export default function MongoPlayground() {
  // A valid JSON default query
  const [query, setQuery] = useState('{\n  "find": "users",\n  "limit": 10\n}');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking', 'connected', 'error'

  // Ping the database on component mount to check connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{"ping": 1}' }),
        });
        if (response.ok) {
          setDbStatus('connected');
        } else {
          setDbStatus('error');
        }
      } catch (err) {
        setDbStatus('error');
      }
    };
    checkConnection();
  }, []);

  const runQuery = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    // Validate if it is valid JSON before sending
    try {
      JSON.parse(query);
    } catch (e) {
      setError("Invalid JSON: " + e.message);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to execute query');
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // Run query on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      runQuery();
    }
  };

  const renderTable = () => {
    if (!results || results.length === 0) {
      return (
        <div className="empty-state">
          Command executed successfully but returned no results.
        </div>
      );
    }

    // Try to build a table if the result is an array of documents
    if (Array.isArray(results) && results.length > 0 && typeof results[0] === 'object') {
      // Get all unique keys across all documents to form headers
      const headerSet = new Set();
      results.forEach(doc => Object.keys(doc).forEach(key => headerSet.add(key)));
      const headers = Array.from(headerSet);

      return (
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((header) => {
                    let value = row[header];
                    if (value === undefined) value = '';
                    else if (value === null) value = 'NULL';
                    else if (typeof value === 'object') value = JSON.stringify(value);
                    else value = String(value);

                    return (
                      <td key={`${rowIndex}-${header}`} className={value === 'NULL' ? 'null-value' : ''}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // If it's just a raw object (e.g. from ping command), dump as JSON
    return (
      <pre className="raw-json-results">
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  };

  return (
    <div className="mongo-playground dark-theme">
      <div className="header">
        <div className="header-title-row">
          <h2>MongoDB Playground</h2>
          <div className={`status-badge ${dbStatus}`}>
            <span className="status-dot"></span>
            {dbStatus === 'checking' && 'Checking Connection...'}
            {dbStatus === 'connected' && 'Connected'}
            {dbStatus === 'error' && 'Connection Error'}
          </div>
        </div>
        <p>Run live JSON commands against your MongoDB instance. Read-only access.</p>
      </div>
      
      <div className="editor-container">
        <div className="editor-toolbar">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="toolbar-title">query.json</span>
        </div>
        <textarea
          className="mongo-editor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your MongoDB JSON command here... (Ctrl + Enter to run)"
          spellCheck="false"
        />
        <div className="actions">
          <button 
            className="run-btn" 
            onClick={runQuery} 
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span> Running...
              </>
            ) : (
              '▶ Run Command'
            )}
          </button>
        </div>
      </div>

      <div className="results-section">
        <h3>Results</h3>
        <div className="results-container">
          {error && (
            <div className="error-box">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <strong>Command Failed</strong>
                <p>{error}</p>
              </div>
            </div>
          )}
          
          {!error && results && renderTable()}
          
          {!error && !results && !isLoading && (
            <div className="placeholder-state">
              Results will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
