import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

interface CertificateOptions {
  orgId: string;
  hash: string;
  fileName: string;
  artifactType: string;
  timestamp: Date;
}

export async function generateCertificateOfAuthenticity(
  options: CertificateOptions
): Promise<Uint8Array> {
  const { orgId, hash, fileName, artifactType, timestamp } = options;

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();

  // Embed fonts
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  // Colors
  const primaryColor = rgb(0.2, 0.4, 0.8);
  const textColor = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.9, 0.9, 0.9);

  // Header with border
  page.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    color: lightGray,
  });

  // Title
  page.drawText('Certificate of Authenticity', {
    x: 50,
    y: height - 60,
    size: 24,
    font: titleFont,
    color: primaryColor,
  });

  page.drawText('ProofMesh Cryptographic Verification', {
    x: 50,
    y: height - 85,
    size: 12,
    font: bodyFont,
    color: textColor,
  });

  // Certificate body
  let yPosition = height - 140;

  // Document Information Section
  page.drawText('Original Document:', {
    x: 50,
    y: yPosition,
    size: 14,
    font: titleFont,
    color: textColor,
  });
  yPosition -= 25;

  page.drawText(`File Name: ${fileName}`, {
    x: 70,
    y: yPosition,
    size: 11,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 20;

  page.drawText(`Artifact Type: ${artifactType}`, {
    x: 70,
    y: yPosition,
    size: 11,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 20;

  page.drawText(`Timestamp: ${timestamp.toISOString()}`, {
    x: 70,
    y: yPosition,
    size: 11,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 40;

  // Cryptographic Proof Section
  page.drawText('Cryptographic Proof:', {
    x: 50,
    y: yPosition,
    size: 14,
    font: titleFont,
    color: textColor,
  });
  yPosition -= 25;

  // Hash (wrapped if needed)
  const hashLabel = 'SHA-256 Hash:';
  page.drawText(hashLabel, {
    x: 70,
    y: yPosition,
    size: 11,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 18;

  // Draw hash in monospace with background
  const hashText = hash.replace('SHA256:', '');
  const hashLines = wrapText(hashText, 70, monoFont, 9);
  
  for (const line of hashLines) {
    page.drawRectangle({
      x: 65,
      y: yPosition - 3,
      width: width - 130,
      height: 16,
      color: lightGray,
    });
    
    page.drawText(line, {
      x: 70,
      y: yPosition,
      size: 9,
      font: monoFont,
      color: textColor,
    });
    yPosition -= 18;
  }

  yPosition -= 20;

  // Organization ID
  page.drawText(`Organization ID: ${orgId}`, {
    x: 70,
    y: yPosition,
    size: 11,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 40;

  // QR Code Section
  page.drawText('Verification QR Code:', {
    x: 50,
    y: yPosition,
    size: 14,
    font: titleFont,
    color: textColor,
  });
  yPosition -= 25;

  page.drawText('Scan to verify this document on the ProofMesh network', {
    x: 70,
    y: yPosition,
    size: 10,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 30;

  // Generate QR code
  const verifyUrl = `https://proofmesh.com/verify?orgId=${orgId}&hash=${hash}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 200,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  // Embed QR code
  const qrCodeImage = await pdfDoc.embedPng(qrCodeDataUrl);
  const qrSize = 150;
  page.drawImage(qrCodeImage, {
    x: 70,
    y: yPosition - qrSize,
    width: qrSize,
    height: qrSize,
  });

  // Verification URL below QR code
  yPosition -= qrSize + 20;
  page.drawText('Verification URL:', {
    x: 70,
    y: yPosition,
    size: 10,
    font: bodyFont,
    color: textColor,
  });
  yPosition -= 15;

  const urlLines = wrapText(verifyUrl, 80, bodyFont, 8);
  for (const line of urlLines) {
    page.drawText(line, {
      x: 70,
      y: yPosition,
      size: 8,
      font: monoFont,
      color: primaryColor,
    });
    yPosition -= 12;
  }

  yPosition -= 30;

  // Footer disclaimer
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: lightGray,
  });
  yPosition -= 20;

  page.drawText(
    'This certificate verifies that the referenced document was cryptographically stamped',
    {
      x: 50,
      y: yPosition,
      size: 8,
      font: bodyFont,
      color: textColor,
    }
  );
  yPosition -= 12;

  page.drawText(
    'on the ProofMesh network at the timestamp shown above. The original document remains',
    {
      x: 50,
      y: yPosition,
      size: 8,
      font: bodyFont,
      color: textColor,
    }
  );
  yPosition -= 12;

  page.drawText(
    'unmodified and can be independently verified using the hash and QR code provided.',
    {
      x: 50,
      y: yPosition,
      size: 8,
      font: bodyFont,
      color: textColor,
    }
  );

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

function wrapText(text: string, maxChars: number, font: any, fontSize: number): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < text.length; i++) {
    currentLine += text[i];
    if (currentLine.length >= maxChars || i === text.length - 1) {
      lines.push(currentLine);
      currentLine = '';
    }
  }

  return lines;
}
