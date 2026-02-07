import requests
import json

doi = "10.1016/j.foodchem.2026.148114"
url = f"https://citation.doi.org/metadata?doi={doi}"
headers = {"Accept": "application/json"}

try:
    print(f"Fetching {url}...")
    resp = requests.get(url, headers=headers, timeout=10)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        # print("Full JSON:", json.dumps(data, indent=2))
        print("Keys:", list(data.keys()))
        if "abstract" in data:
            print(f"ABSTRACT FOUND! Length: {len(data['abstract'])}")
            print(f"Start: {data['abstract'][:50]}...")
        else:
            print("ABSTRACT NOT FOUND in JSON.")
            print("No 'abstract' field found in JSON.")
    else:
        print("Response text:", resp.text)

except Exception as e:
    print(f"Error: {e}")

print("-" * 20)
# Also try standard DOI.org to compare
url2 = f"https://doi.org/{doi}"
headers2 = {"Accept": "application/vnd.citationstyles.csl+json"}
try:
    print(f"Fetching {url2} (Standard CSL)...")
    resp = requests.get(url2, headers=headers2, timeout=10)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        if "abstract" in data:
             print(f"Abstract found (len={len(data['abstract'])})")
        else:
             print("No 'abstract' field found in standard CSL.")
except Exception as e:
    print(f"Error: {e}")
