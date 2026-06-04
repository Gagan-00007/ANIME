import React, { useState } from 'react';
import MongoPlayground from './MongoPlayground';
import SqlPlayground from './SqlPlayground';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('mongo');

  return (
    <div className="app-container">
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'mongo' ? 'active' : ''}`}
          onClick={() => setActiveTab('mongo')}
        >
          <span className="tab-icon">🍃</span> MongoDB Playground
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
          onClick={() => setActiveTab('sql')}
        >
          <span className="tab-icon">🐘</span> PostgreSQL (Supabase)
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'mongo' ? <MongoPlayground /> : <SqlPlayground />}
      </div>
    </div>
  )
}

export default App;
