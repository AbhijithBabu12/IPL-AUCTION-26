"use client";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export async function downloadPngFromSvg(
  svgMarkup: string,
  filename: string,
  width: number,
  height: number,
) {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Could not generate image.");

    downloadBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadSimplePdf(filename: string, title: string, lines: string[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 40;
  const startY = 790;
  const lineHeight = 16;
  const maxLinesPerPage = 44;

  const pages: string[][] = [];
  let current: string[] = [];

  for (const line of [title, "", ...lines]) {
    current.push(line);
    if (current.length >= maxLinesPerPage) {
      pages.push(current);
      current = [];
    }
  }
  if (current.length > 0) pages.push(current);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const pageKids: string[] = [];
  const firstPageObjectId = 4;
  const firstContentObjectId = 5;

  for (let index = 0; index < pages.length; index += 1) {
    const pageObjectId = firstPageObjectId + index * 2;
    const contentObjectId = firstContentObjectId + index * 2;
    pageObjectIds.push(pageObjectId);
    pageKids.push(`${pageObjectId} 0 R`);
  }

  objects.push(
    `<< /Type /Pages /Kids [${pageKids.join(" ")}] /Count ${pages.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const linesForPage = pages[pageIndex]!;
    const contentLines = ["BT", "/F1 12 Tf", `${marginX} ${startY} Td`];

    linesForPage.forEach((line, index) => {
      if (index === 0) contentLines.push(`(${escapePdfText(line)}) Tj`);
      else contentLines.push(`0 -${lineHeight} Td (${escapePdfText(line)}) Tj`);
    });

    contentLines.push("ET");
    const stream = contentLines.join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${firstContentObjectId + pageIndex * 2} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  downloadBlob(new Blob([pdf], { type: "application/pdf" }), filename);
}
