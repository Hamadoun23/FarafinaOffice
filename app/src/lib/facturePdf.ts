/**
 * PDF de facture, genere cote client en rejouant le rendu de la facture
 * (html2canvas) dans un document jsPDF — utilise par la page publique
 * pour le telechargement, sans backend PDF dedie.
 */

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const LARGEUR_A4 = 210;
const HAUTEUR_A4 = 297;
const TAILLE_MAX = 2 * 1024 * 1024;

export async function genererPdfFacture(noeud: HTMLElement, numero: string) {
  const canvas = await html2canvas(noeud, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const largeurImg = LARGEUR_A4;
  const hauteurImg = (canvas.height * largeurImg) / canvas.width;

  // JPEG plutot que PNG : une facture (fond blanc, texte net) ne perd
  // rien a l'oeil meme compressee, et le fichier passe de plusieurs Mo
  // a quelques centaines de ko. On redescend la qualite si besoin pour
  // rester sous 2 Mo, meme pour une facture a beaucoup de lignes
  // (plusieurs pages).
  const construire = (qualite: number) => {
    const imgData = canvas.toDataURL("image/jpeg", qualite);
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    let restant = hauteurImg;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, largeurImg, hauteurImg);
    restant -= HAUTEUR_A4;
    while (restant > 0) {
      position -= HAUTEUR_A4;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, largeurImg, hauteurImg);
      restant -= HAUTEUR_A4;
    }
    return pdf;
  };

  let qualite = 0.92;
  let pdf = construire(qualite);
  let blob: Blob = pdf.output("blob");
  while (blob.size > TAILLE_MAX && qualite > 0.3) {
    qualite -= 0.15;
    pdf = construire(qualite);
    blob = pdf.output("blob");
  }

  return { blob, nomFichier: `Facture-${numero}.pdf` };
}

export function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
