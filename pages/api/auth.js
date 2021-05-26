const fetch = require("node-fetch");
const clientId = "89a9c70728f84f44b040de0071b1ff94";
const clientSecret = process.env.CLIENT_SECRET;

export default async (req, res) => {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    const auth = await fetch("https://accounts.spotify.com/authorize", {
        method: "POST",
        body: params,
        headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    });

    const authData = await auth.json();
    const { access_token, token_type } = authData || {};
    res.status(200).json({ access_token });
};
