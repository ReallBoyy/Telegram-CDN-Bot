const express = require('express');
const fs = require('fs');
const https = require('https');
const rateLimiter = require('express-rate-limit');
const cors = require('cors');
const app = express();

const options = {
    key: fs.readFileSync("cert/server.key"),
    cert: fs.readFileSync("cert/server.crt")
};

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(rateLimiter({ windowMs: 1 * 60 * 1000, max: 1000, headers: true }));

app.use('/cache', express.static('./db'));

https.createServer(options, app).listen(443, () => {
    console.log('HTTPS Server running on port 443')
})

module.exports;