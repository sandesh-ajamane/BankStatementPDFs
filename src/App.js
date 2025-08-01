import React, { useState } from 'react';
import UploadPDF from './components/UploadPDF';
import './App.css';

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.entry';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';

GlobalWorkerOptions.workerSrc = pdfWorker;

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [tableData, setTableData] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editRowData, setEditRowData] = useState({});

  const renderPdfPageAsImage = async (file, password) => {
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const loadingTask = getDocument({ data: typedarray, password });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // First page (adjust if needed)
  
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    canvas.height = viewport.height;
    canvas.width = viewport.width;
  
    await page.render({ canvasContext: context, viewport }).promise;
  
    return canvas.toDataURL();
  };

  
  const downloadPDF = async () => {
    if (!selectedFile || !pdfPassword) {
      alert("No file or password.");
      return;
    }
  
    try {
      const imgData = await renderPdfPageAsImage(selectedFile, pdfPassword);
      const doc = new jsPDF('p', 'pt', 'a4'); // Portrait, points, A4
  
      // Add image of original PDF as background
      doc.addImage(imgData, 'PNG', 0, 0, 595.28, 841.89);
  
      // Add edited table
      autoTable(doc, {
        head: [['Sr No', 'Date', 'Remarks', 'Debit', 'Credit', 'Balance']],
        body: tableData.map(row => [
          row.srNo,
          row.date,
          row.remarks,
          row.debit || '-',
          row.credit || '-',
          row.balance
        ]),
        startY: 300, // Adjust to where the original table starts
        styles: {
          fontSize: 9,
          overflow: 'linebreak',
          cellPadding: 3
        },
      });
  
      // Save final PDF
      doc.save('updated_bank_statement.pdf');
    } catch (error) {
      console.error("❌ Failed to generate PDF:", error);
      alert("Unable to generate PDF. Check password or format.");
    }
  };
  

  
  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (!pdfPassword) return alert('Please enter a password.');
    setShowPasswordModal(false);
    readPdfWithPassword(selectedFile, pdfPassword);
  };

  const readPdfWithPassword = async (file, password) => {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      try {
        const loadingTask = getDocument({ data: typedarray, password });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(item => item.str);
          fullText += strings.join(' ') + '\n';
        }

        const transactionRegex = /(\d+)\s+(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+₹\s+([\d,]+\.\d{2})/g;
        const matches = [...fullText.matchAll(transactionRegex)];

        const structuredData = matches.map((match) => {
          const [, srNo, date, remarksRaw, amount, balance] = match;
          const remarks = remarksRaw.trim().replace(/\s+/g, ' ');
          const line = match[0];
          const isDebit = /\bDR\b|\bDr\b/.test(line);
          return {
            srNo,
            date,
            remarks,
            debit: isDebit ? amount : '',
            credit: !isDebit ? amount : '',
            balance,
          };
        });

        setTableData(structuredData);
      } catch (err) {
        console.error('❌ PDF Error:', err.message);
        alert('Wrong password or corrupted PDF.');
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  const handleEdit = (index, row) => {
    setEditIndex(index);
    setEditRowData({ ...row });
  };

  const handleDelete = (index) => {
    const updatedData = tableData.filter((_, i) => i !== index);
    setTableData(updatedData);
    if (editIndex === index) {
      setEditIndex(null);
      setEditRowData({});
    }
  };

  const handleDone = (index) => {
    const updatedData = [...tableData];
    updatedData[index] = editRowData;
    setTableData(updatedData);
    setEditIndex(null);
    setEditRowData({});
  };

  const handleInputChange = (field, value) => {
    setEditRowData(prev => ({ ...prev, [field]: value }));
  };

  const recalculateUpToRow = (rowIndex) => {
    const updatedData = [...tableData];

    const parseAmount = (val) => parseFloat((val || '0').replace(/,/g, ''));

    if (updatedData.length === 0) return;

    let currentBalance = parseAmount(updatedData[0].balance);
    updatedData[0].balance = currentBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
    });

    for (let i = 1; i <= rowIndex; i++) {
      const debit = parseAmount(updatedData[i].debit);
      const credit = parseAmount(updatedData[i].credit);

      currentBalance = currentBalance + credit - debit;

      updatedData[i].balance = currentBalance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
      });
    }

    setTableData(updatedData);
  };

  const recalculateAllRows = () => {
    const updatedData = [...tableData];
    const parseAmount = (val) => parseFloat((val || '0').replace(/,/g, ''));
    if (updatedData.length === 0) return;

    let currentBalance = parseAmount(updatedData[0].balance);
    updatedData[0].balance = currentBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
    });

    for (let i = 1; i < updatedData.length; i++) {
      const debit = parseAmount(updatedData[i].debit);
      const credit = parseAmount(updatedData[i].credit);

      currentBalance = currentBalance + credit - debit;

      updatedData[i].balance = currentBalance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
      });
    }

    setTableData(updatedData);
  };

  return (
    <div className="container">
      <UploadPDF onFileSelected={handleFileSelected} />

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Enter PDF Password</h3>
            <input
              type="password"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              placeholder="Password"
            />
            <div className="modal-actions">
              <button onClick={handlePasswordSubmit}>Submit</button>
              <button onClick={() => setShowPasswordModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

<button
  onClick={downloadPDF}
  style={{
    marginBottom: '10px',
    marginLeft: '10px',
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
  }}
>
  <i className="fa fa-download" style={{ marginRight: '5px' }}></i>
  Download Updated PDF
</button>

      {tableData.length > 0 && (
        <div className="table-container">
          <button
            onClick={recalculateAllRows}
            style={{
              marginBottom: '10px',
              padding: '8px 16px',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            <i className="fa fa-refresh" style={{ marginRight: '5px' }}></i>
            Recalculate All Balances
          </button>

          <table className="pdf-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Date</th>
                <th>Remarks</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  <td>{row.srNo}</td>
                  <td>{row.date}</td>
                  <td>
                    {editIndex === index ? (
                      <input
                        value={editRowData.remarks}
                        onChange={(e) => handleInputChange('remarks', e.target.value)}
                      />
                    ) : (
                      row.remarks
                    )}
                  </td>
                  <td>
                    {editIndex === index ? (
                      <input
                        value={editRowData.debit}
                        onChange={(e) => handleInputChange('debit', e.target.value)}
                      />
                    ) : (
                      row.debit || '-'
                    )}
                  </td>
                  <td>
                    {editIndex === index ? (
                      <input
                        value={editRowData.credit}
                        onChange={(e) => handleInputChange('credit', e.target.value)}
                      />
                    ) : (
                      row.credit || '-'
                    )}
                  </td>
                  <td>₹ {row.balance}</td>
                  <td>
                    {editIndex === index ? (
                      <button
                        title="Done"
                        onClick={() => handleDone(index)}
                        style={{ backgroundColor: '#28a745', color: 'white', marginRight: 5 }}
                      >
                        <i className="fa fa-check"></i>
                      </button>
                    ) : (
                      <>
                        <button
                          title="Edit"
                          onClick={() => handleEdit(index, row)}
                          style={{ backgroundColor: '#007bff', color: 'white', marginRight: 5 }}
                        >
                          <i className="fa fa-edit"></i>
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(index)}
                          style={{ backgroundColor: '#dc3545', color: 'white', marginRight: 5 }}
                        >
                          <i className="fa fa-trash"></i>
                        </button>
                        <button
                          title="Recalculate Balance to This Row"
                          onClick={() => recalculateUpToRow(index)}
                          style={{ backgroundColor: '#17a2b8', color: 'white' }}
                        >
                          <i className="fa fa-check"></i>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
