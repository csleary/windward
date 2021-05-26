import { faPause, faPlay } from "@fortawesome/free-solid-svg-icons";
import { vertexShaderSource, fragmentShaderSource } from "../shaders";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Head from "next/head";
import classnames from "classnames";
import styles from "../styles/Home.module.css";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";

const vertices = new Float32Array([-1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1]);
const itemSize = 2;
const numItems = vertices.length / itemSize;

const Home = () => {
    const canvasRef = useRef();
    const playerRef = useRef();
    const playerIdRef = useRef();
    const programRef = useRef();
    const rafIdRef = useRef();
    const tracksRef = useRef([]);
    const currentTime = useRef(0);
    const [currentTrackId, setCurrentTrackId] = useState("");
    const [errors, setErrors] = useState({});
    const [isFetching, setIsFetching] = useState(false);
    const [playerIsReady, setPlayerIsReady] = useState(false);
    const [playerState, setPlayerState] = useState("stopped");
    const [visualsPlaying, setVisualsPlaying] = useState(false);
    const [token, setToken] = useState();
    const [tracks, setTracks] = useState([]);

    const resize = () => {
        canvasRef.current.width = window.innerHeight;
        canvasRef.current.height = window.innerHeight;
    };

    const createProgram = () => {
        const gl = canvasRef.current.getContext("webgl");
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        programRef.current = gl.createProgram();
        const program = programRef.current;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        program.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
        gl.enableVertexAttribArray(program.aVertexPosition);
        gl.vertexAttribPointer(program.aVertexPosition, itemSize, gl.FLOAT, false, 0, 0);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        program.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
        gl.enableVertexAttribArray(program.aVertexPosition);
        gl.vertexAttribPointer(program.aVertexPosition, itemSize, gl.FLOAT, false, 0, 0);
    };

    const render = () => {
        const gl = canvasRef.current.getContext("webgl");
        gl.viewport(0, 0, canvasRef.current.width, canvasRef.current.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const program = programRef.current;
        const uPosition = gl.getUniformLocation(program, "u_resolution");
        gl.uniform2fv(uPosition, [canvasRef.current.width, canvasRef.current.height]);
        const uTime = gl.getUniformLocation(programRef.current, "u_time");
        currentTime.current += 16.666 * 0.001;
        gl.uniform1f(uTime, currentTime.current);
        gl.drawArrays(gl.TRIANGLES, 0, numItems);
        rafIdRef.current = requestAnimationFrame(render);
    };

    useEffect(() => {
        resize();
        window.addEventListener("resize", resize);
        createProgram();

        return () => {
            window.removeEventListener("resize", resize);
        };
    }, []);

    useEffect(() => {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const access_token = urlParams.get("access_token");
        if (access_token) setToken(access_token);
    }, []);

    useEffect(() => {
        fetch(`/api/aetw`).then(async res => {
            const data = await res.json();
            setTracks(data.album.items);
            tracksRef.current = data.album.items;
        });
    }, []);

    useEffect(() => {
        window.onSpotifyWebPlaybackSDKReady = () => {
            playerRef.current = new Spotify.Player({
                name: "An Eye to Windward player",
                getOAuthToken: callback => {
                    callback(token);
                },
            });

            playerRef.current.addListener("player_state_changed", async state => {
                if (state.paused === true && state.position === 0 && !isFetching) {
                    const currentTrackId = state.track_window.current_track.id;
                    const currentTrackIndex = tracksRef.current.findIndex(track => track.id === currentTrackId);

                    if (tracksRef.current[currentTrackIndex + 1]) {
                        setIsFetching(true);
                        await handleFetchTrack(tracksRef.current[currentTrackIndex + 1].uri);
                    }
                } else if (state.paused === true) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
                    setPlayerState("paused");
                } else {
                    console.log(state);
                    if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(render);
                    setVisualsPlaying(true);
                    setCurrentTrackId(state.track_window.current_track.id);
                    setPlayerState("playing");
                }
            });

            playerRef.current.addListener("initialization_error", ({ message }) =>
                setErrors(prev => ({ ...prev, player: message }))
            );

            playerRef.current.addListener("authentication_error", ({ message }) => {
                console.error("Failed to authenticate Spotify account: %s", message);
                setErrors(prev => ({ ...prev, auth: message }));
                handleAuth();
            });

            playerRef.current.addListener("account_error", ({ message }) => {
                console.error("Failed to validate Spotify account: %s", message);
                setErrors(prev => ({ ...prev, account: message }));
            });

            playerRef.current.addListener("playback_error", ({ message }) => {
                console.error("Failed to validate Spotify account: %s", message);
                setErrors(prev => ({ ...prev, player: message }));
            });

            playerRef.current.addListener("not_ready", ({ device_id }) => {
                setPlayerIsReady(false);
            });

            playerRef.current.addListener("ready", ({ device_id }) => {
                playerIdRef.current = device_id;
                setPlayerIsReady(true);
            });

            if (!token) return;

            playerRef.current.connect().then(success => {
                if (success) setPlayerIsReady(true);
                else setPlayerIsReady(false);
            });
        };
    }, [token]);

    const handleFetchTrack = async spotify_uri => {
        playerRef.current._options.getOAuthToken(access_token => {
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${playerIdRef.current}`, {
                method: "PUT",
                body: JSON.stringify({ uris: [spotify_uri] }),
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
            }).then(() => setIsFetching(false));
        });
    };

    const handlePlayTrack = async () => {
        if (!playerIdRef.current) return;

        if (playerIsReady && playerState === "stopped") {
            handleFetchTrack(tracks[0].uri);
        } else if (playerIsReady && playerState === "playing") {
            await playerRef.current.pause();
        } else if (playerIsReady && playerState === "paused") {
            await playerRef.current.resume();
        }
    };

    const handleVisuals = () => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
            setVisualsPlaying(false);
        } else {
            rafIdRef.current = requestAnimationFrame(render);
            setVisualsPlaying(true);
        }
    };

    const handleAuth = () => {
        const redirectUri =
            process.env.NEXT_PUBLIC_NODE_ENV === "development"
                ? "http://localhost:3000/api/redirect"
                : "https://aetw.ochremusic.com/api/redirect";

        const params = new URLSearchParams();
        params.append("client_id", "89a9c70728f84f44b040de0071b1ff94");
        params.append("response_type", "code");
        params.append("redirect_uri", redirectUri);
        params.append("scope", "streaming user-read-email user-read-private");
        window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>An Eye to Windward</title>
                <link rel="icon" href="/favicon.ico" />
                <script src="https://sdk.scdn.co/spotify-player.js"></script>
            </Head>
            <main className={styles.main}>
                <canvas ref={ref => (canvasRef.current = ref)} onClick={handleVisuals}></canvas>
                <button
                    className={classnames(styles.visuals, { [styles.active]: !visualsPlaying })}
                    onClick={handleVisuals}
                >
                    <FontAwesomeIcon className={styles.icon} icon={faPlay} />
                </button>
            </main>
            <ul className={styles.info}>
                <h2>An Eye to Windward</h2>
                <div
                    className={classnames(styles.tracks, { [styles.disabled]: !token || !tracks.length })}
                    title={!token ? "Please log in to play tracks through Spotify." : ""}
                >
                    {tracks.map((track, index) => (
                        <li
                            className={classnames(styles.track, {
                                [styles.disabled]: !token || !tracks.length,
                                [styles.active]: currentTrackId === track.id,
                            })}
                            key={track.id}
                            onClick={() => {
                                cancelAnimationFrame(rafIdRef.current);
                                rafIdRef.current = null;
                                currentTime.current = 0;
                                handleFetchTrack(track.uri);
                            }}
                            tabIndex={0}
                        >
                            {(index + 1).toString().padStart(2, "0")} {track.name}{" "}
                            {Math.trunc(track.duration_ms / 60000)}:
                            {Math.round((track.duration_ms / 1000) % 60)
                                .toString()
                                .padStart(2, "0")}
                        </li>
                    ))}
                </div>
                <h3>Vinyl</h3>
                <li className={styles.link}>
                    <a href="https://clone.nl/item63624.html" rel="nofollow noreferrer">
                        Clone (EU)
                    </a>
                </li>
                <li className={styles.link}>
                    <a href="https://bleep.com/release/220862-ochre-an-eye-to-windward" rel="nofollow noreferrer">
                        Bleep (UK)
                    </a>
                </li>
                <li className={styles.link}>
                    <a
                        href="https://www.juno.co.uk/products/ochre-an-eye-to-windward/814099-01/"
                        rel="nofollow noreferrer"
                    >
                        Juno (UK)
                    </a>
                </li>
                <li className={styles.link}>
                    <a href="https://www.decks.de/track/ochre-an_eye_to_windward/chs-rr" rel="nofollow noreferrer">
                        Decks (EU)
                    </a>
                </li>
                <li className={styles.link}>
                    <a href="https://furtherrecords.com/shop/ochre-an-eye-to-windward-vinyl/" rel="nofollow noreferrer">
                        Further (US)
                    </a>
                </li>
                <li className={styles.link}>
                    <a href="https://audiopile.ca/product/an-eye-to-windward/" rel="nofollow noreferrer">
                        Audiopile (CA)
                    </a>
                </li>
                <li className={styles.link}>
                    <a href="https://www.technique.co.jp/item/236529,PHAINOMENA02.html" rel="nofollow noreferrer">
                        Technique (JP)
                    </a>
                </li>
            </ul>
            {!token ? (
                <button className={styles.auth} onClick={handleAuth}>
                    <FontAwesomeIcon className={styles.spotify} icon={faSpotify} />
                    Log In
                </button>
            ) : (
                <button className={styles.button} onClick={handlePlayTrack}>
                    <FontAwesomeIcon
                        className={classnames(styles.icon, { [styles.disabled]: !token || !tracks.length })}
                        icon={["stopped", "paused"].includes(playerState) ? faPlay : faPause}
                    />
                </button>
            )}
            {Object.values(errors).filter(error => Boolean(error)).length
                ? Object.keys(errors).map((key, index) => (
                      <div className={styles.errors} key={index}>
                          <span onClick={() => setErrors(prev => ({ ...prev, [key]: "" }))}>{errors[key]}</span>
                          <br />
                      </div>
                  ))
                : null}
        </div>
    );
};

export default Home;
