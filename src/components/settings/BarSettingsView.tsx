import React from 'react';
import { BarMasterView } from '../masters/BarMasterView';

export const BarSettingsView: React.FC = () => {
  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
      <BarMasterView language="en" />
    </div>
  );
};
