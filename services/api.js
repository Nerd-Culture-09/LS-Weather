import { DEFAULT_PLACE } from '../constants/app_constants';

const BASE_URL_UAT = 'https://10.20.0.171:9294/insight/miniapps/';
const CURRENT_ENV = "UAT";

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

function getJson(url) {
  return new Promise((resolve, reject) => {
    my.request({
      url,
      method: "GET",
      dataType: 'json',
      success: (res) => {
        resolve(res.data);
      },
      fail: (error) => {
        reject(error);
      }
    });
  });
}

// timezone=auto returns times in the place's own local time
function locationQuery(place) {
  const p = place || DEFAULT_PLACE;
  return `latitude=${p.latitude}&longitude=${p.longitude}&timezone=auto`;
}

export const weatherApi = {

  getCurrentWeather: (place) => {
    return getJson(`${FORECAST_URL}?${locationQuery(place)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m`);
  },

  getWeatherForcast: (place) => {
    // Hourly codes are needed because the daily weather_code is the day's worst hour, not its character.
    // The other hourly fields feed the hour-by-hour sun dial.
    return getJson(`${FORECAST_URL}?${locationQuery(place)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,wind_speed_10m_max&hourly=weather_code,is_day,temperature_2m,precipitation_probability,wind_speed_10m,relative_humidity_2m&forecast_days=7`);
  },


  getCustomerInfo: (inputValue) => {
    console.log({
      action: 'G',
      eventId: "10596",
      msisdn: "26659389854",
      miniAppTxId: "3483010251992326",
      thirdPartyRef: inputValue
    });
    if (CURRENT_ENV == "UAT") {
      return new Promise((resolve, reject) => {
        my.request({
          url: BASE_URL_UAT + 'G',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": "ApiKey on6my5pbj28fqadcpyz9kolunbtdturv"
          },
          data: {
            "eventId": "10662",
            "action": "GB",
            "msisdn": "26659389854"

          },
          dataType: 'json',
          success: (result) => {
            console.log(result);
            resolve(result.data);
          },
          fail: (error) => {
            reject(error);
          }
        });
      });

    } else {
      return new Promise((resolve, reject) => {
        my.call("makeRequest", {
          "payload": JSON.stringify({
            "msisdn": "msisdn",
            "proxiedRequest": {
              "needsIdentity": true,
              "needsPIN": true,
              "requestInfo": {
                "httpMethod": "POST",
                "payload": JSON.stringify({
                  "action": "G",
                  "eventId": ENVENT_ID,
                  "msisdn": "msisdn",
                  "miniAppTxId": MINI_APP_ID,
                  "thirdPartyRef": inputValue
                }),
                "headers": {
                  "Content-Type": "application/json",
                  "Authorization": "ApiKey on6my5pbj28fqadcpyz9kolunbtdturv"
                }
              }
            }
          }),
          "replaceParams": [
            "msisdn"
          ],
          "url": BASE_URL_PROD,
          success: (result) => {
            console.log(result);
            resolve(JSON.parse(result.proxiedResponse.data.content));
          },
          fail: (error) => {
            console.log(error);
            reject(error);
          }
        });

      });
    }
  },

}