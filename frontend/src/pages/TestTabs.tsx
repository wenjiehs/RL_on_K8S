import React, { useState } from 'react';
import { Tabs, Card } from 'tdesign-react';

const TestTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <div style={{ padding: '20px' }}>
      <h1>Tab Component Test</h1>
      
      <Card style={{ marginTop: '20px' }}>
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as string)}>
          <Tabs.TabPanel value="tab1" label="Tab 1">
            <div style={{ padding: '20px' }}>
              <h3>This is Tab 1 Content</h3>
              <p>If you can see this, Tabs component is working!</p>
            </div>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="tab2" label="Tab 2">
            <div style={{ padding: '20px' }}>
              <h3>This is Tab 2 Content</h3>
              <p>Tab 2 content here</p>
            </div>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="tab3" label="Tab 3">
            <div style={{ padding: '20px' }}>
              <h3>This is Tab 3 Content</h3>
              <p>Tab 3 content here</p>
            </div>
          </Tabs.TabPanel>
        </Tabs>
      </Card>

      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>Active Tab: {activeTab}</p>
        <p>TDesign Version: Check package.json</p>
      </div>
    </div>
  );
};

export default TestTabs;