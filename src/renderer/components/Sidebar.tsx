import React, { useState } from 'react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  children: React.ReactNode;
  isCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  children, 
  isCollapsed = false,
  onToggle 
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const handleToggle = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    onToggle?.(newState);
  };

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <button 
        className={styles.toggleButton}
        onClick={handleToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};
