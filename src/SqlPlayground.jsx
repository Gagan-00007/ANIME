import React, { useState } from 'react';
import './SqlPlayground.css';

export default function SqlPlayground() {
  const [query, setQuery] = useState('SELECT * FROM users\nORDER BY created_at DESC');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const runQuery = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

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
          Query executed successfully but returned no results.
        </div>
      );
    }

    const headers = Object.keys(results[0]);

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
                  if (value === null) value = 'NULL';
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
  };

  return (
    <div className="sql-playground dark-theme">
      <div className="header">
        <h2>SQL Playground</h2>
        <p>Run live queries against the Supabase database. Read-only access.</p>
      </div>
      
      <div className="editor-container">
        <div className="editor-toolbar">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="toolbar-title">query.sql</span>
        </div>
        <textarea
          className="sql-editor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your SQL query here... (Ctrl + Enter to run)"
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
              '▶ Run Query'
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
                <strong>Query Failed</strong>
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
