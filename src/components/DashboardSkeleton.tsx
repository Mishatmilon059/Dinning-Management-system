import React from "react";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-muted rounded-lg"></div>
          <div className="h-4 w-80 bg-muted rounded-lg"></div>
        </div>
        <div className="h-10 w-36 bg-muted rounded-xl"></div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="h-28 bg-muted rounded-2xl"></div>
        <div className="h-28 bg-muted rounded-2xl"></div>
        <div className="h-28 bg-muted rounded-2xl"></div>
      </div>

      {/* Content Columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-96 bg-muted rounded-2xl"></div>
          <div className="h-64 bg-muted rounded-2xl"></div>
        </div>
        {/* Side Panel */}
        <div className="space-y-6">
          <div className="h-80 bg-muted rounded-2xl"></div>
          <div className="h-48 bg-muted rounded-2xl"></div>
        </div>
      </div>
    </div>
  );
};
export default DashboardSkeleton;
