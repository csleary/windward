const fetch = require("node-fetch");
const { fetchToken } = require("../../utils");

export default async (req, res) => {
    const access_token = await fetchToken();

    const windward = await fetch("https://api.spotify.com/v1/albums/46eTxD65jWJ2h5eCtOGH6d/tracks", {
        headers: { Authorization: `Bearer ${access_token}` },
    });

    const windwardData = await windward.json();
    res.status(200).json({ album: windwardData, access_token });
};
