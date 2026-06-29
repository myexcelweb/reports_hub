import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';

// Shown when a user clicks a count in any report table.
// Displays a table with detailed case information.
export default function CaseListModal({ show, title, rows, onClose }) {
  // rows is an array of objects (each row from processedData)
  const hasData = rows && rows.length > 0;

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {hasData ? (
          <Table striped bordered hover responsive size="sm">
            <thead className="table-dark">
              <tr>
                <th>SR NO</th>
                <th>CASE NUMBER (UID)</th>
                <th>BJ OBJ</th>
                <th>DIS NATURE</th>
                <th>NATURE</th>
                <th>ACT</th>
                <th>DATE OF REG</th>
                <th>DATE OF DIS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{row.UID || ''}</td>
                  <td>{row['BJ OBJ'] || ''}</td>
                  <td>{row['DIS NATURE'] || ''}</td>
                  <td>{row.NATURE || ''}</td>
                  <td>{row.ACT || ''}</td>
                  <td>{row['DATE OF REG'] || ''}</td>
                  <td>{row['DATE OF DIS'] || ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-muted mb-0">No cases to display.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}