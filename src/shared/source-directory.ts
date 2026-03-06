import type { AudienceKey, ConditionKey, SourceType } from "./content";

export type SourceDirectoryEntry = {
  id: string;
  name: string;
  sourceType: SourceType;
  region: string;
  url: string;
  focus: string;
  conditions: ConditionKey[];
  audiences: AudienceKey[];
};

export const sourceDirectory: SourceDirectoryEntry[] = [
  {
    id: "cdc",
    name: "CDC",
    sourceType: "official",
    region: "美国",
    url: "https://www.cdc.gov/autism/",
    focus: "自闭症筛查、基础介绍、家庭资源",
    conditions: ["autism"],
    audiences: ["family", "clinician"],
  },
  {
    id: "nimh",
    name: "NIMH",
    sourceType: "official",
    region: "美国",
    url: "https://www.nimh.nih.gov/health/topics/attention-deficit-hyperactivity-disorder-adhd",
    focus: "ADHD 与相关精神健康主题的官方科普与治疗信息",
    conditions: ["adhd", "autism"],
    audiences: ["family", "self-advocate", "clinician"],
  },
  {
    id: "nice",
    name: "NICE",
    sourceType: "official",
    region: "英国",
    url: "https://www.nice.org.uk/guidance/ng87",
    focus: "循证指南、临床建议、教育与照护路径",
    conditions: ["adhd", "autism"],
    audiences: ["clinician", "educator", "researcher"],
  },
  {
    id: "nhs",
    name: "NHS",
    sourceType: "official",
    region: "英国",
    url: "https://www.nhs.uk/conditions/autism/",
    focus: "公众导向的自闭症与支持服务信息",
    conditions: ["autism"],
    audiences: ["family", "self-advocate"],
  },
  {
    id: "chadd",
    name: "CHADD",
    sourceType: "official",
    region: "美国",
    url: "https://chadd.org/",
    focus: "ADHD 教育、家庭支持、学校与职场资源",
    conditions: ["adhd"],
    audiences: ["family", "self-advocate", "educator", "employer"],
  },
  {
    id: "ncld",
    name: "NCLD",
    sourceType: "official",
    region: "美国",
    url: "https://www.ncld.org/",
    focus: "学习困难、学校支持、政策倡导",
    conditions: ["learning-difficulties"],
    audiences: ["family", "educator"],
  },
  {
    id: "understood",
    name: "Understood",
    sourceType: "media",
    region: "美国",
    url: "https://www.understood.org/",
    focus: "面向家长和老师的学习差异实用资源",
    conditions: ["learning-difficulties", "adhd"],
    audiences: ["family", "educator"],
  },
  {
    id: "autistica",
    name: "Autistica",
    sourceType: "official",
    region: "英国",
    url: "https://www.autistica.org.uk/",
    focus: "自闭症研究、政策倡导与生活支持",
    conditions: ["autism", "neurodiversity"],
    audiences: ["self-advocate", "researcher", "family"],
  },
  {
    id: "aane",
    name: "AANE",
    sourceType: "official",
    region: "美国",
    url: "https://aane.org/",
    focus: "面向自闭症成人与家庭的支持、活动与资源",
    conditions: ["autism"],
    audiences: ["self-advocate", "family"],
  },
  {
    id: "autism-speaks",
    name: "Autism Speaks",
    sourceType: "official",
    region: "美国",
    url: "https://www.autismspeaks.org/",
    focus: "自闭症工具包、服务目录与家庭资源入口",
    conditions: ["autism"],
    audiences: ["family", "self-advocate"],
  },
  {
    id: "nas",
    name: "National Autistic Society",
    sourceType: "official",
    region: "英国",
    url: "https://www.autism.org.uk/",
    focus: "英国自闭症支持、权利倡导与实务信息",
    conditions: ["autism"],
    audiences: ["family", "self-advocate", "educator", "employer"],
  },
  {
    id: "raising-children",
    name: "Raising Children Network",
    sourceType: "official",
    region: "澳大利亚",
    url: "https://raisingchildren.net.au/autism",
    focus: "家长向自闭症与 ADHD 日常支持资源",
    conditions: ["autism", "adhd"],
    audiences: ["family"],
  },
  {
    id: "healthdirect",
    name: "healthdirect",
    sourceType: "official",
    region: "澳大利亚",
    url: "https://www.healthdirect.gov.au/autism",
    focus: "澳洲健康信息入口，适合基础科普与就医导航",
    conditions: ["autism", "adhd"],
    audiences: ["family", "self-advocate"],
  },
  {
    id: "camh",
    name: "CAMH",
    sourceType: "official",
    region: "加拿大",
    url: "https://www.camh.ca/",
    focus: "精神健康与神经发育相关教育资源",
    conditions: ["adhd", "neurodiversity"],
    audiences: ["family", "clinician", "researcher"],
  },
  {
    id: "caddac",
    name: "CADDAC",
    sourceType: "official",
    region: "加拿大",
    url: "https://caddac.ca/",
    focus: "ADHD 教育、倡导、学校与职场工具",
    conditions: ["adhd"],
    audiences: ["family", "educator", "employer", "self-advocate"],
  },
  {
    id: "kidshealth",
    name: "Nemours KidsHealth",
    sourceType: "official",
    region: "美国",
    url: "https://kidshealth.org/",
    focus: "儿童健康科普，自闭症与 ADHD 基础说明",
    conditions: ["autism", "adhd", "learning-difficulties"],
    audiences: ["family"],
  },
  {
    id: "wrightslaw",
    name: "Wrightslaw",
    sourceType: "official",
    region: "美国",
    url: "https://www.wrightslaw.com/",
    focus: "特殊教育权利、学校支持与家长倡导",
    conditions: ["adhd", "autism", "learning-difficulties"],
    audiences: ["family", "educator"],
  },
  {
    id: "dyslexia-intl",
    name: "Dyslexia International",
    sourceType: "official",
    region: "国际",
    url: "https://www.dyslexia-international.org/",
    focus: "阅读障碍与学习困难的国际资源",
    conditions: ["learning-difficulties"],
    audiences: ["family", "educator"],
  },
  {
    id: "child-mind",
    name: "Child Mind Institute",
    sourceType: "official",
    region: "美国",
    url: "https://childmind.org/",
    focus: "儿童神经发育与精神健康资源库",
    conditions: ["adhd", "autism", "learning-difficulties"],
    audiences: ["family", "clinician"],
  },
  {
    id: "additude",
    name: "ADDitude",
    sourceType: "media",
    region: "美国",
    url: "https://www.additudemag.com/",
    focus: "ADHD 大众内容、学校与家庭实操",
    conditions: ["adhd", "learning-difficulties"],
    audiences: ["family", "self-advocate", "educator"],
  },
  {
    id: "edresearch",
    name: "Education Endowment Foundation",
    sourceType: "official",
    region: "英国",
    url: "https://educationendowmentfoundation.org.uk/",
    focus: "教育干预证据和学校支持策略",
    conditions: ["learning-difficulties", "adhd", "autism"],
    audiences: ["educator", "researcher"],
  },
  {
    id: "pubmed",
    name: "PubMed",
    sourceType: "academic",
    region: "国际",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    focus: "医学与健康研究论文检索",
    conditions: ["neurodiversity", "autism", "adhd", "learning-difficulties"],
    audiences: ["researcher", "clinician"],
  },
  {
    id: "cochrane",
    name: "Cochrane Library",
    sourceType: "academic",
    region: "国际",
    url: "https://www.cochranelibrary.com/",
    focus: "系统综述与高等级循证证据",
    conditions: ["autism", "adhd", "learning-difficulties"],
    audiences: ["researcher", "clinician"],
  },
  {
    id: "trip",
    name: "TRIP Database",
    sourceType: "academic",
    region: "国际",
    url: "https://www.tripdatabase.com/",
    focus: "指南、综述和临床证据检索",
    conditions: ["autism", "adhd", "learning-difficulties"],
    audiences: ["clinician", "researcher"],
  },
];

export function findSourceDirectoryEntry(input: { sourceName?: string; url?: string }): SourceDirectoryEntry | undefined {
  const sourceName = input.sourceName?.trim().toLowerCase();
  const url = input.url;

  return sourceDirectory.find((entry) => {
    if (sourceName && entry.name.trim().toLowerCase() === sourceName) {
      return true;
    }
    if (url && (url.startsWith(entry.url) || entry.url.startsWith(url))) {
      return true;
    }
    try {
      if (!url) {
        return false;
      }
      const urlHost = new URL(url).hostname.replace(/^www\./, "");
      const entryHost = new URL(entry.url).hostname.replace(/^www\./, "");
      return urlHost === entryHost;
    } catch {
      return false;
    }
  });
}

export function listRegions(): string[] {
  return Array.from(new Set(sourceDirectory.map((entry) => entry.region))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}
