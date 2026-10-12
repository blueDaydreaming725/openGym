#!/usr/bin/env python3
"""
M2 端到端验收：一天三餐拍照记录跑通
前置：server/.env 中 VISION_API_KEY 已填有效 key（阿里云百炼 → API-KEY 管理 → 创建）
用法：cd server && python3 testdata/e2e.py
"""
import base64
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BASE = 'http://127.0.0.1:3300'

TOKEN = ''
for line in open(os.path.join(ROOT, '.env')):
    if line.startswith('API_TOKEN='):
        TOKEN = line.strip().split('=', 1)[1]


def call(path, payload=None, timeout=90):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {TOKEN}'},
        method='POST' if payload is not None else 'GET',
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def parse_meal(image):
    data_url = 'data:image/jpeg;base64,' + base64.b64encode(open(image, 'rb').read()).decode()
    return call('/api/agent/meal-parse', {'imageDataUrl': data_url})


def main():
    ok = True
    total_kcal = 0
    for meal in ['breakfast', 'lunch', 'dinner']:
        image = os.path.join(HERE, f'{meal}.jpg')
        r = parse_meal(image)
        if r['code'] != 0 or not r['data']['foods']:
            print(f'[FAIL] {meal}: {r.get("message", "无食物返回")}')
            ok = False
            continue
        foods = r['data']['foods']
        kcal = sum(f['calories'] for f in foods)
        total_kcal += kcal
        print(f'[PASS] {meal}: ' + '、'.join(f"{f['name']} {f['calories']}kcal" for f in foods))
        print(f'       点评: {r["data"]["comment"]}')
    print(f'\n三餐合计: {total_kcal} kcal')

    rec = call('/api/agent/supplement-rec', {
        'weightKg': 64,
        'goal': 'cut',
        'healthMetrics': [{'key': 'vitamin_d', 'label': '维生素D', 'value': 18, 'unit': 'ng/mL', 'flag': 'low'}],
        'planSummary': '形体期 PPL 三分化',
    })
    names = [i['name'] for i in rec['data']['items']]
    print(f'[{"PASS" if names else "FAIL"}] 补剂推荐({rec["data"]["source"]}): {"、".join(names)}')

    if not (ok and names):
        sys.exit(1)
    print('\n=== M2 端到端验收通过 ===')


if __name__ == '__main__':
    main()
