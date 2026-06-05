const RAIN_CODES = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);

interface WeatherResult {
  temperature: number;
  weatherCode: number;
  precipitationProbMax: number;
  isRainingNow: boolean;
}

interface AirResult {
  pm10: number;
  pm25: number;
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherResult | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=precipitation_probability_max&timezone=Asia/Seoul&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      temperature: d.current?.temperature_2m ?? 15,
      weatherCode: d.current?.weather_code ?? 0,
      precipitationProbMax: d.daily?.precipitation_probability_max?.[0] ?? 0,
      isRainingNow: RAIN_CODES.has(d.current?.weather_code ?? 0),
    };
  } catch { return null; }
}

async function fetchAirQuality(lat: number, lng: number): Promise<AirResult | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5&timezone=Asia/Seoul`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return { pm10: d.current?.pm10 ?? 0, pm25: d.current?.pm2_5 ?? 0 };
  } catch { return null; }
}

function buildMessage(w: WeatherResult | null, a: AirResult | null): string {
  if (!w) return '오늘도 산책 나가볼까요? 🐾';
  const { temperature, isRainingNow, precipitationProbMax } = w;
  const pm10 = a?.pm10 ?? 0;
  const pm25 = a?.pm25 ?? 0;
  if (isRainingNow) return '지금 비가 와요 🌧️\n우산 챙기고 짧게 다녀오세요';
  if (precipitationProbMax >= 70) return '오늘 비 예보가 있어요 🌂\n미리 다녀오세요';
  if (pm25 > 35 || pm10 > 80) return '미세먼지가 심해요 😷\n짧게 다녀오세요';
  if (temperature > 33) return '많이 더워요 🌡️\n아침저녁에 짧게 다녀오세요';
  if (temperature < -5) return '많이 추워요 🧊\n따뜻하게 입고 짧게 다녀오세요';
  if (precipitationProbMax >= 40) return '비가 올 수도 있어요 🌥️\n미리 다녀오세요';
  return '산책하기 딱 좋은\n날씨예요 ☀️';
}

function buildChip(w: WeatherResult | null): string {
  if (!w) return '';
  const code = w.weatherCode;
  const rain = w.isRainingNow;
  let emoji = '☀️';
  let cond = '맑음';
  if (rain) { emoji = code >= 95 ? '⛈️' : code >= 80 ? '🌦️' : '🌧️'; cond = code >= 95 ? '천둥' : code >= 80 ? '소나기' : '비'; }
  else if (code === 0) { emoji = '☀️'; cond = '맑음'; }
  else if (code <= 3) { emoji = '🌤️'; cond = '구름 조금'; }
  else if (code <= 48) { emoji = '🌫️'; cond = '안개'; }
  else if (code <= 77) { emoji = '❄️'; cond = '눈'; }
  else { emoji = '☁️'; cond = '흐림'; }
  return `${emoji} ${cond} · ${Math.round(w.temperature)}°`;
}

export async function fetchWalkWeatherFull(
  lat: number,
  lng: number,
): Promise<{ message: string; chip: string }> {
  const [w, a] = await Promise.all([fetchWeather(lat, lng), fetchAirQuality(lat, lng)]);
  return { message: buildMessage(w, a), chip: buildChip(w) };
}
