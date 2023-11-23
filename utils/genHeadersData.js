function generateLocalHeader() {
  //const base64 = Buffer.from(`${process.env.LOCAL_api}:${process.env.LOCAL_SECRET}`).toString('base64');
  //const authHeader = `Basic ${base64}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.LOCAL_SECRET}`,
    accept: "application/json",
  };

  return headers;
}

module.exports = { generateLocalHeader };
