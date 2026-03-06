import { describe, expect, it } from "vitest";
import { academicHarvesterInternals } from "../src/server/academic-harvester";

const pubmedHtml = `
<html>
  <head>
    <meta name="citation_title" content="Understanding, Educating, and Supporting Children with Specific Learning Disabilities: 50 Years of Science and Practice">
    <meta name="citation_journal_title" content="Am Psychol">
    <meta name="citation_pmid" content="31081650">
    <meta name="citation_doi" content="10.1037/amp0000452">
    <meta name="description" content="Specific learning disabilities are relevant to research and practice.">
    <meta name="citation_author" content="Elena L Grigorenko">
    <meta name="citation_author" content="Donald Compton">
    <meta name="citation_publication_date" content="2019 May 13">
  </head>
  <body>
    <span class="identifier pmc">
      <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6851403/">PMC6851403</a>
    </span>
    <div class="abstract-content selected">
      <p>Specific learning disabilities are highly relevant to the science and practice of psychology.</p>
    </div>
  </body>
</html>
`;

const pmcHtml = `
<html>
  <head>
    <meta name="citation_title" content="Understanding, Educating, and Supporting Children with Specific Learning Disabilities: 50 Years of Science and Practice">
    <meta name="citation_journal_title" content="American Psychologist">
    <meta name="citation_publication_date" content="2019 May 13">
    <meta name="citation_doi" content="10.1037/amp0000452">
    <meta name="citation_pmid" content="31081650">
    <meta name="citation_author" content="Elena L Grigorenko">
    <meta name="citation_author" content="Donald Compton">
    <meta name="citation_pdf_url" content="https://pmc.ncbi.nlm.nih.gov/articles/PMC6851403/pdf/nihms-1029312.pdf">
    <meta name="description" content="Specific learning disabilities (SLD) are highly relevant to the science and practice of psychology.">
  </head>
  <body>
    <section class="abstract" id="ABS1">
      <h2>Abstract</h2>
      <p>Specific learning disabilities are highly relevant to the science and practice of psychology. The paper reviews manifestation, identification, etiology, and intervention.</p>
    </section>
    <section class="body main-article-body">
      <h2>Manifestation, Definition, and Etiology</h2>
      <p>This section discusses how SLD are defined and why interdisciplinary assessment matters for identification.</p>
      <h2>Intervention</h2>
      <p>This section reviews evidence-based instruction and coordinated support across school and family settings.</p>
      <h2>Implications for Practice and Research</h2>
      <p>The review argues that interdisciplinary evaluation and individualized instruction should be treated as core practice principles.</p>
    </section>
  </body>
</html>
`;

describe("academic harvester", () => {
  it("extracts the PMCID article url from a PubMed page", () => {
    expect(academicHarvesterInternals.extractPmcUrlFromPubMed(pubmedHtml)).toBe(
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC6851403/",
    );
  });

  it("parses a PMC article into structured academic fields", () => {
    const result = academicHarvesterInternals.extractPmcDocument(
      pmcHtml,
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC6851403/",
    );
    expect(result.title).toContain("Specific Learning Disabilities");
    expect(result.journal).toBe("American Psychologist");
    expect(result.pmid).toBe("31081650");
    expect(result.pdfUrl).toContain("nihms-1029312.pdf");
    expect(result.authors).toEqual(["Elena L Grigorenko", "Donald Compton"]);
    expect(result.sectionSummaries).toHaveLength(3);
    expect(result.sectionSummaries[0].title).toBe("Manifestation, Definition, and Etiology");
  });

  it("falls back to PubMed abstract metadata when full text is unavailable", () => {
    const result = academicHarvesterInternals.extractPubMedDocument(
      pubmedHtml,
      "https://pubmed.ncbi.nlm.nih.gov/31081650/",
    );
    expect(result.title).toContain("Specific Learning Disabilities");
    expect(result.abstractText).toContain("science and practice of psychology");
    expect(result.authors).toEqual(["Elena L Grigorenko", "Donald Compton"]);
  });
});
