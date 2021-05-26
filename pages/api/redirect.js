const clientId = "89a9c70728f84f44b040de0071b1ff94";
const clientSecret = process.env.CLIENT_SECRET;

export default async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(200).redirect("/");
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append(
        "redirect_uri",
        process.env.NODE_ENV === "development"
            ? "http://localhost:3000/api/redirect"
            : "https://aetw.ochremusic.com/api/redirect"
    );

    const auth = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        body: params,
        headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    });

    const authData = await auth.json();
    const { access_token } = authData || {};
    const tokenParams = new URLSearchParams();
    tokenParams.append("access_token", access_token);
    res.status(200).redirect(`/?${tokenParams.toString()}`);
};
