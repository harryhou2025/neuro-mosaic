import { describe, expect, it } from "vitest";
import { harvestInternals } from "../src/server/source-harvester";

describe("source harvester parsers", () => {
  it("extracts title, description and published time from html meta", () => {
    const html = `
      <html>
        <head>
          <title>Example Article</title>
          <meta property="og:description" content="An example description." />
          <meta property="article:published_time" content="2026-03-06T00:00:00Z" />
        </head>
      </html>
    `;
    const result = harvestInternals.extractHtmlMeta(html);
    expect(result.title).toBe("Example Article");
    expect(result.description).toBe("An example description.");
    expect(result.publishedAt).toBe("2026-03-06T00:00:00Z");
  });

  it("parses rss item blocks", () => {
    const xml = `
      <rss>
        <channel>
          <item>
            <title><![CDATA[ADHD support in school]]></title>
            <link>https://example.com/post</link>
            <description><![CDATA[Practical supports for families.]]></description>
            <pubDate>Fri, 06 Mar 2026 01:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;
    const result = harvestInternals.parseRssXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("ADHD support in school");
    expect(result[0].link).toBe("https://example.com/post");
    expect(result[0].description).toContain("Practical supports");
  });
});
