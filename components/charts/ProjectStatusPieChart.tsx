
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TaskStatus } from '../../types';

interface ChartData {
  name: TaskStatus;
  value: number;
}

interface ProjectStatusPieChartProps {
  data: ChartData[];
}

const COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Completed]: '#22c55e',
  [TaskStatus.InProgress]: '#f59e0b',
  [TaskStatus.NotStarted]: '#6b7280',
  [TaskStatus.AtRisk]: '#ef4444',
};

const ProjectStatusPieChart: React.FC<ProjectStatusPieChartProps> = ({ data }) => {
  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
                backgroundColor: 'rgba(30, 41, 59, 0.9)', 
                borderColor: '#475569',
                borderRadius: '0.5rem'
            }}
            itemStyle={{ color: '#e2e8f0' }} 
          />
          <Legend
            iconSize={10}
            formatter={(value) => <span className="text-slate-300">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProjectStatusPieChart;