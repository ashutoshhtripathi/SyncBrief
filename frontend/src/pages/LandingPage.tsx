import React from 'react';
import { TodayDashboard } from '../components/TodayDashboard';

interface LandingPageProps {
  onOpenQuickAdd?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenQuickAdd = () => {} }) => {
  return (
    <div className="space-y-6 pb-20">
      <TodayDashboard onOpenQuickAdd={onOpenQuickAdd} />
    </div>
  );
};
