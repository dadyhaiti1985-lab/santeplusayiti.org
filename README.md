# Sante Plus Ayiti - Server

1) Install

```bash
cd "/Users/macbook/Desktop/sante plus ayiti"
npm install
```

2) Configure

```bash
cp .env.example .env
# set PAYPAL_ACCESS_TOKEN in .env
```

3) Run

```bash
npm run start
# or for dev:
npm run dev
```

Endpoints:
- POST /api/create-order
- POST /api/capture-order/:orderID
