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

const publisherHtml = `
<html>
  <head>
    <meta name="citation_title" content="Neurodiversity-affirming support in higher education">
    <meta name="citation_journal_title" content="Journal of Inclusive Education">
    <meta name="citation_publication_date" content="2026 Feb 28">
    <meta name="citation_doi" content="10.1000/example-doi">
    <meta name="citation_author" content="Alex Chen">
    <meta name="citation_author" content="Rui Wang">
    <meta name="citation_pdf_url" content="https://example.org/article.pdf">
    <meta name="description" content="This article reviews practical support for neurodivergent students in higher education.">
    <meta property="og:url" content="https://example.org/article">
  </head>
  <body>
    <section class="abstract">
      <p>This article reviews practical support for neurodivergent students in higher education.</p>
    </section>
    <h2>Methods</h2>
    <p>We conducted a scoping review of accommodation, support, and inclusion studies.</p>
    <h2>Implications for Practice</h2>
    <p>Universities should improve accommodation processes, advising, and student-led support.</p>
  </body>
</html>
`;

const pubmedWithPublisherHtml = `
<html>
  <head>
    <meta name="citation_title" content="Neurodiversity-affirming support in higher education">
    <meta name="citation_journal_title" content="Journal of Inclusive Education">
    <meta name="citation_doi" content="10.1000/example-doi">
  </head>
  <body>
    <span class="identifier doi">
      <a class="id-link usa-link--external" href="https://doi.org/10.1000/example-doi">10.1000/example-doi</a>
    </span>
    <div class="full-text-links-list">
      <a href="https://example.org/article">Full text at publisher</a>
    </div>
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

  it("extracts publisher full text and DOI links from PubMed HTML", () => {
    const links = academicHarvesterInternals.extractFullTextUrlsFromPubMed(pubmedWithPublisherHtml);
    expect(links.map((link) => link.href)).toContain("https://example.org/article");
    expect(links.map((link) => link.href)).toContain("https://doi.org/10.1000/example-doi");
  });

  it("parses a publisher article page into structured academic fields", () => {
    const result = academicHarvesterInternals.parseGenericAcademicDocument(
      publisherHtml,
      "https://example.org/article",
    );
    expect(result.title).toBe("Neurodiversity-affirming support in higher education");
    expect(result.journal).toBe("Journal of Inclusive Education");
    expect(result.authors).toEqual(["Alex Chen", "Rui Wang"]);
    expect(result.articleUrl).toBe("https://example.org/article");
    expect(result.sectionSummaries).toHaveLength(2);
  });
});
