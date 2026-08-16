import React, { useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploadProps {
  label: string;
  onFileSelect: (file: File) => void;
  acceptedFileType: string;
  fileName: string | null;
  onFileClear?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect, acceptedFileType, fileName, onFileClear }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
     // Reset the input value to allow re-uploading the same file
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };
  
  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onFileClear) {
      onFileClear();
    }
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };


  return (
    <div className="w-full min-w-0">
      <label className="block text-sm font-medium text-slate-300 mb-1 truncate" title={label}>{label}</label>
      <div className="relative w-full min-w-0">
        <input
          type="file"
          ref={inputRef}
          onChange={handleFileChange}
          accept={acceptedFileType}
          className="hidden"
        />
        <button
          onClick={handleButtonClick}
          title={fileName || 'Choose File'}
          className="w-full min-w-0 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-md transition-colors duration-200 flex items-center text-left pr-8 overflow-hidden"
        >
          <UploadIcon className="w-5 h-5 mr-2 flex-shrink-0" />
          <span className="truncate text-xs flex-grow min-w-0" title={fileName || 'Choose File...'}>
            {fileName || 'Choose File...'}
          </span>
        </button>
        {fileName && onFileClear && (
            <button
              onClick={handleClearClick}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full bg-slate-700/80"
              aria-label="Clear file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        )}
      </div>
    </div>
  );
};

export default FileUpload;