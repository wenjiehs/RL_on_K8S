import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Dialog, MessagePlugin } from 'tdesign-react';

interface WebTerminalProps {
  visible: boolean;
  onClose: () => void;
  envName: string;
  namespace: string;
}

const WebTerminal: React.FC<WebTerminalProps> = ({ visible, onClose, envName, namespace }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!visible || !terminalRef.current) return;

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      rows: 30,
      cols: 100,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal in DOM
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    const wsUrl = `ws://localhost:8080/api/terminal/connect?name=${envName}&namespace=${namespace}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      terminal.writeln('\x1b[1;32m✓ Connected to Ray Head Pod\x1b[0m');
      terminal.writeln('');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'output' && message.content) {
          // Write the content directly to terminal - let xterm.js handle ANSI sequences
          terminal.write(message.content);
        } else if (message.type === 'error' && message.content) {
          terminal.writeln(`\x1b[1;31mError: ${message.content}\x1b[0m`);
        } else if (message.type === 'status' && message.content) {
          terminal.writeln(`\x1b[1;36m${message.content}\x1b[0m`);
        }
      } catch (e) {
        // If it's not JSON, treat as raw terminal output (for raw terminal data)
        terminal.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
      terminal.writeln('\x1b[1;31m✗ Connection error\x1b[0m');
      MessagePlugin.error('Failed to connect to terminal');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      terminal.writeln('\x1b[1;33m\r\n✗ Connection closed\x1b[0m');
    };

    // Handle terminal input
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data: data,
        }));
      }
    });

    // Handle terminal resize
    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          rows: terminal.rows,
          cols: terminal.cols,
        }));
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      terminal.dispose();
    };
  }, [visible, envName, namespace]);

  const handleClose = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      header={
        <div className="flex items-center justify-between">
          <span>Terminal - {envName}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${
              connectionStatus === 'connected' ? 'text-green-500' : 
              connectionStatus === 'connecting' ? 'text-yellow-500' : 
              'text-red-500'
            }`}>
              {connectionStatus === 'connected' ? '● Connected' : 
               connectionStatus === 'connecting' ? '● Connecting...' : 
               '● Disconnected'}
            </span>
          </div>
        </div>
      }
      width="80%"
      footer={null}
      destroyOnClose
    >
      <div 
        ref={terminalRef} 
        style={{ 
          height: '500px',
          backgroundColor: '#1e1e1e',
          padding: '8px',
          borderRadius: '4px',
        }}
      />
    </Dialog>
  );
};

export default WebTerminal;