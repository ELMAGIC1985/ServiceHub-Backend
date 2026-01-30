const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`${method} ${url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  } else {
    console.log('Body: (empty or no body)');
  }

  console.log('Query Params:', JSON.stringify(req.query, null, 2));
  console.log('=== END REQUEST LOG ===\n');

  next();
};

export { requestLogger };
