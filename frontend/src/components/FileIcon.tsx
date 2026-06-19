import React from 'react';

interface FileIconProps {
  fileType: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const fileTypeConfig: Record<string, { color: string; bg: string; icon: JSX.Element; label: string }> = {
  pdf: {
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
      </svg>
    ),
    label: 'PDF',
  },
  docx: {
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 3l-2 6h1.5l.5-1.5h2L14 18h1.5l-2-6h-2.5zm.88 3.5L12 13.25l.12 1.25h-.24z"/>
      </svg>
    ),
    label: 'DOCX',
  },
  txt: {
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
      </svg>
    ),
    label: 'TXT',
  },
  md: {
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
      </svg>
    ),
    label: 'MD',
  },
  mp3: {
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    ),
    label: 'Audio',
  },
};

const defaultConfig = {
  color: 'text-secondary-700',
  bg: 'bg-secondary-100',
  icon: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
    </svg>
  ),
  label: 'File',
};

const FileIcon: React.FC<FileIconProps> = ({ fileType, size = 'md', showLabel = false, className = '' }) => {
  const config = fileTypeConfig[fileType?.toLowerCase()] || defaultConfig;
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className={`${sizeClasses[size]} ${config.bg} ${config.color} rounded-lg p-1 flex-shrink-0`}>
        {config.icon}
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold ${config.color}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default FileIcon;