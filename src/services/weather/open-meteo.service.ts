/**
 * Open-Meteo weather forecast client — ADR-266 §5.8 / Phase D.3 Weather Risk
 *
 * Free European weather API, no API key required.
 * Docs: https://open-meteo.com/en/docs
 *
 * Used only for construction alert rules — skipped if building has no coordinates.
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('OpenMeteoService');

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 2;

export interface DailyWeatherForecast {
  date: string;
  precipitationMm: number;
  windspeedKmh: number;
}

export interface WeatherForecast {
  daily: DailyWeatherForecast[];
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    precipitation_sum: number[];
    windspeed_10m_max: number[];
  };
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
): Promise<WeatherForecast | null> {
  const url =
    `${BASE_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&daily=precipitation_sum,windspeed_10m_max&forecast_days=${FORECAST_DAYS}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      logger.error(`Open-Meteo HTTP ${res.status} for (${latitude}, ${longitude})`);
      return null;
    }

    const data = (await res.json()) as OpenMeteoResponse;
    const { time, precipitation_sum, windspeed_10m_max } = data.daily;

    const daily: DailyWeatherForecast[] = time.map((date, i) => ({
      date,
      precipitationMm: precipitation_sum[i] ?? 0,
      windspeedKmh: windspeed_10m_max[i] ?? 0,
    }));

    return { daily };
  } catch (err) {
    logger.error(`Open-Meteo fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
