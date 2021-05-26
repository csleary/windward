const vertexShaderSource = `attribute vec2 aVertexPosition;
void main() {
    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}`;

const fragmentShaderSource = `#ifdef GL_ES
precision highp float;
#endif

#define PI 3.14159265359
uniform vec2 u_resolution;
uniform float u_time;

float random_2(vec2 p) {
  vec2 K1 = vec2(23.14069263277926, 2.665144142690225);
  return fract(cos(dot(p, K1)) * 12345.6789);
}

float random(in vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(in vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

#define OCTAVES 10
float fbm(in vec2 st) {
  float value = 0.0;
  float amplitude = .5;
  float frequency = 0.;

  for (int i = 0; i < OCTAVES; i++) {
    value += amplitude * noise(st);
    st *= 2.;
    amplitude *= .5;
  }

  return value;
}

float fbm2(in vec2 st) {
  float value = 0.0;
  float amplitude = .5;
  float frequency = 0.;

  for (int i = 0; i < 2; i++) {
    value += amplitude * noise(st);
    st *= 2.;
    amplitude *= .5;
  }

  return value;
}

mat2 rotate2d(float _angle) {
  return mat2(cos(_angle), -sin(_angle), sin(_angle), cos(_angle));
}

float cubicPulse(float pos, float width, float x, float exp) {
  x = abs(x - pos);

  if (x > width)
    return 0.;

  x /= width;
  return 1.0 - pow(x, exp);
}

float create_ray(vec2 st, float radius) {
  st = vec2(0.5) - st;
  float r = length(st) * .74;
  float a = atan(st.x, st.y) * 0.2;
  float m = abs(mod(a + u_time / .3, PI * 2.) - PI) / (2. * PI);
  float f = radius;
  f /= noise(vec2((u_time + 20.) * a * 10., (u_time + 50.) * m * 10.));
  return 1. - smoothstep(f, f + .7, r * 3.);
}

float create_object(vec2 st, float radius) {
  st = vec2(0.5) - st;
  float r = length(st) * .7;
  float a = atan(st.x, st.y) * 0.2;
  float m = abs(mod(a + u_time / .3, PI * 2.) - PI) / (2. * PI);
  float f = radius;
  f /= fbm(vec2((u_time + 20.) * a * 10., (u_time + 50.) * m * .001));
  return 1. - smoothstep(f, f + .7, r * 3.);
}

float fade(float start_time, float duration, float value_from, float value_to) {
  return clamp((u_time - start_time) / duration, value_from, value_to);
}

void main() {
  vec3 canvas = vec3(0., 0., 0.);
  vec2 st = gl_FragCoord.xy / u_resolution;
  vec2 warp = st;
  vec2 twist = st;
  vec3 h;
  vec3 rays1;
  vec3 rays2;
  vec3 object;
  vec3 v;
  float t = u_time;

  for (int i = 0; i < 3; i++) {
    warp +=
        fbm(vec2(u_time + (warp.x * 100.), u_time + (warp.y * 100.))) * 0.01;

    warp.x -= sin(u_time) * 0.0005;
    warp.y -= cos(u_time) * 0.0005;

    h[i] =
        (cubicPulse(0.5, fbm(vec2(.3, st.y)), warp.x, min(.2 * u_time, 50.)));
    v[i] = (cubicPulse(0.5, fbm(vec2(.3, st.x)), warp.y,
                       min(pow(.2 * u_time, .25), 50.)));

    warp -= vec2(0.5);
    warp *= rotate2d(noise(vec2(t, 5.) * .5) * (PI / 32.) - (PI / 64.));
    warp += vec2(0.5);

    twist +=
        noise(vec2(u_time + (twist.x * 5.), u_time + (twist.y * 5.))) * 0.01;

    twist += noise(vec2(u_time + (warp.x * 8.), u_time + (warp.y * 5.))) * 0.01;
    twist -= vec2(0.5);
    twist *= rotate2d(sin(t) * PI / 64.);
    twist += vec2(0.5);
    rays1 = vec3(1.) * create_ray(st, 0.35);
    rays2 = vec3(1.) * create_ray(vec2(1. - st.x, st.y), 0.38);
    object = vec3(1.) * create_object(st, 0.35);

    t -= 100.;
  }

  vec3 portal = vec3(h * v);
  vec3 inner = vec3(.5);
  float inner_time = u_time / 4.;
  float l;
  float z = (inner_time + 50.) * .1;
  vec2 radial = warp;
  vec3 stars = vec3(0.);

  // Portal texture
  for (int i = 0; i < 3; i++) {
    float texture =
        fbm2(vec2(inner_time - (warp.x * 8.) * .5, inner_time + (warp.y * 5.)));

    portal[i] += pow(abs(texture) + .2, 5.) * (.1 + (float(i) * .15));
    portal -= texture * inner * .5;
    inner[i] += .1;
    inner_time -= 50.25;

    // Portal field
    vec2 p = warp;
    p -= .5;
    l = length(p);
    radial += p / l * mod(z, 50.) * mod(l * .09 - z * .2, .5);

    // Stars
    stars +=
        (.01 / length(abs(mod(mod(warp * radial, float(i)), 1.) - .5))) * .2;
  }

  // Fade in stars
  if (u_time > 60.) {
    portal += (stars * fade(60., 15., 0., 1.));
  }

  // portal += stars;
  portal -= (rays1 * .025);
  portal -= (rays2 * .025);
  portal -= (object * .025);
  canvas += portal;

  // Noise
  vec2 uvRandom = st;
  uvRandom.y *= random_2(vec2(uvRandom.y, u_time));
  canvas.rgb += random_2(uvRandom) * 0.05;

  gl_FragColor = vec4(canvas, 1.0);
}`;

export { vertexShaderSource, fragmentShaderSource };
