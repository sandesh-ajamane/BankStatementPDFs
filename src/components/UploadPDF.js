import React, { useState } from 'react';

function UploadPDF({ onFileSelected }) {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      onFileSelected(file); // Send file to parent component
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload Your PDF</h2>

      <label htmlFor="pdf-upload" className="upload-btn">
        Choose PDF
      </label>
      <input
        type="file"
        id="pdf-upload"
        accept="application/pdf"
        onChange={handleFileChange}
      />

      {selectedFile && (
        <p className="file-info">Selected File: {selectedFile.name}</p>
      )}
    </div>
  );
}

export default UploadPDF;
