use crate::db::Paper;
use once_cell::sync::Lazy;
use regex::Regex;

static RIS_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?m)^([A-Z0-9]{2})\s+-\s+(.*)$").unwrap());

pub fn parse_ris(content: &str) -> Vec<Paper> {
    let mut papers = Vec::new();
    let mut current_paper: Option<Paper> = None;
    let mut current_ris_chunk = String::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if line == "ER  -" {
            if let Some(mut p) = current_paper.take() {
                p.ris_content = Some(current_ris_chunk.clone());
                papers.push(p);
            }
            current_ris_chunk.clear();
            continue;
        }

        if let Some(caps) = RIS_REGEX.captures(line) {
            let tag = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let value = caps.get(2).map(|m| m.as_str().trim()).unwrap_or("");

            current_ris_chunk.push_str(line);
            current_ris_chunk.push('\n');

            if current_paper.is_none() {
                current_paper = Some(Paper {
                    id: 0,
                    website: "Imported".to_string(),
                    journal_name: String::new(),
                    issue_volume: String::new(),
                    issue_date: String::new(),
                    title: String::new(),
                    doi: String::new(),
                    abstract_text: String::new(),
                    title_cn: None,
                    abstract_cn: None,
                    local_path: None,
                    ris_content: None,
                    pdfs: vec![],
                    groups: vec![],
                });
            }

            if let Some(ref mut p) = current_paper {
                match tag {
                    "TI" | "T1" => p.title = value.to_string(),
                    "AB" | "N2" => p.abstract_text = value.to_string(),
                    "DO" => p.doi = value.replace("https://doi.org/", ""),
                    "JO" | "T2" | "JF" => p.journal_name = value.to_string(),
                    "VL" => p.issue_volume = value.to_string(),
                    "PY" | "DA" => p.issue_date = value.to_string(),
                    _ => {}
                }
            }
        } else if let Some(ref mut p) = current_paper {
            // Append to previous field (multiline support, especially for abstract)
            // This is a simple implementation, standard RIS might have sophisticated multiline rules
            p.abstract_text.push(' ');
            p.abstract_text.push_str(line);
            current_ris_chunk.push_str(line);
            current_ris_chunk.push('\n');
        }
    }

    papers
}

pub fn to_ris(paper: &Paper) -> String {
    if let Some(ref ris) = paper.ris_content {
        let ris_str: &String = ris;
        if !ris_str.is_empty() {
            return ris_str.clone();
        }
    }

    // Fallback generate simple RIS
    let mut ris = String::new();
    ris.push_str("TY  - JOUR\n");
    ris.push_str(&format!("TI  - {}\n", paper.title));
    ris.push_str(&format!("JO  - {}\n", paper.journal_name));
    ris.push_str(&format!("VL  - {}\n", paper.issue_volume));
    ris.push_str(&format!("PY  - {}\n", paper.issue_date));
    ris.push_str(&format!("DO  - {}\n", paper.doi));
    ris.push_str(&format!("AB  - {}\n", paper.abstract_text));
    ris.push_str("ER  - \n");
    ris
}

pub fn to_bibtex(paper: &Paper) -> String {
    let clean_title = paper.title.replace('{', "").replace('}', "");
    let id = if !paper.doi.is_empty() {
        paper.doi.clone()
    } else {
        paper.id.to_string()
    };

    let mut bib = String::new();
    bib.push_str(&format!("@article{{{},\n", id));
    bib.push_str(&format!("  title = {{{}}},\n", clean_title));
    bib.push_str(&format!("  journal = {{{}}},\n", paper.journal_name));
    bib.push_str(&format!("  volume = {{{}}},\n", paper.issue_volume));
    bib.push_str(&format!("  year = {{{}}},\n", paper.issue_date));
    bib.push_str(&format!("  doi = {{{}}},\n", paper.doi));
    bib.push_str(&format!("  abstract = {{{}}}\n", paper.abstract_text));
    bib.push_str("}\n");
    bib
}
