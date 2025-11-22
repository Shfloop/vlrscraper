const axios = require("axios");
const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");
const { timezone } = require("../database/database");
/**
 * Retrieves and parses match data from the VLR website.
 * @returns {Object} An object containing match details including team names, countries, match status, event name, tournament name, match image URL, and match ETA.
 */
async function getMatches() {
  // Send a request to the specified URL and parse the HTML response using cheerio
  const { data } = await axios.get(`${vlrgg_url}/matches`);
  const $ = cheerio.load(data);

  // Array to store match objects
  const matches = [];

  // Iterate over each match item on the page and extract relevant information
  $(".wf-module-item.match-item").each((index, element) => {
    // Extract team names and remove unnecessary whitespace and characters
    const team1AndTeam2 = $(element)
      .find(".match-item-vs-team-name")
      .text()
      .replace(/\t/g, "")
      .trim();
    const [team1, team2] = team1AndTeam2
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item !== "");

    // Extract country codes for both teams
    const countryElements = $(element).find(".match-item-vs-team .flag");
    const countryTeam1 = countryElements
      .eq(0)
      .attr("class")
      .split(" ")[1]
      .replace("mod-", "");
    const countryTeam2 = countryElements
      .eq(1)
      .attr("class")
      .split(" ")[1]
      .replace("mod-", "");

    const teamsScores = $(element)
      .find(".match-item-vs-team-score")
      .text()
      .replace(/\t/g, "")
      .trim();
    const [pointsTeam1, pointsTeam2] = teamsScores
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item !== "");

    // Extract match status, event name, tournament name, match image URL, match ETA, and match ID
    const status = $(element).find(".ml-status").text().trim();
    const event = $(element).find(".match-item-event-series").text().trim();
    const tournament = $(element)
      .find(".match-item-event")
      .text()
      .replace(/\t/g, "")
      .trim()
      .replace(event, "")
      .trim()
      .replace(/\n/g, "");
    const img = $(element)
      .find(".match-item-icon img")
      .attr("src")
      .includes("/img/vlr")
      ? vlrgg_url + $(element).find(".match-item-icon img").attr("src")
      : "https:" + $(element).find(".match-item-icon img").attr("src");
    const matchETA = $(element).find(".ml-eta").text().trim();
    const id = $(element).attr("href").split("/")[1];

    const parent = $(element.parent);
    const dateContaier = parent.prev();
    const date = dateContaier.text().trim().replace("Today", "");
    const time = $(element).find(".match-item-time").text().trim();
    const dateAndTime = date + " " + time + " " + timezone;
    console.log(dateAndTime);
    const newDate = new Date(dateAndTime);
    let timestamp = newDate.getTime();
    timestamp = Math.floor(timestamp / 1000);
    const utcString = newDate.toUTCString();

    // Create match object and push it to the matches array
    matches.push({
      id,
      teams: [
        {
          name: team1,
          country: countryTeam1,
          score: pointsTeam1 !== "–" ? pointsTeam1 : null,
        },
        {
          name: team2,
          country: countryTeam2,
          score: pointsTeam2 !== "–" ? pointsTeam2 : null,
        },
      ],
      status,
      event,
      tournament,
      img,
      in: matchETA,
      timestamp,
      utcDate: utcString,
      utc: newDate
    });
  });

  // Return an object containing the number of matches and the matches array
  return {
    size: matches.length,
    matches,
  };
}

function parseDateString(dateStr) {
  const months = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };

  const parts = dateStr.split(" ");
  const dayOfWeek = parts[0].replace(",", ""); // e.g., "Sat"
  const month = months[parts[1]]; // e.g., "July" -> 6
  const day = parseInt(parts[2].replace(",", ""), 10); // e.g., "20"
  const year = parseInt(parts[3], 10); // e.g., "2024"
  const timeParts = parts[4].split(":"); // e.g., "3:00"
  let hours = parseInt(timeParts[0], 10); // e.g., "3"
  const minutes = parseInt(timeParts[1], 10); // e.g., "00"
  const ampm = parts[5]; // e.g., "AM"

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  return new Date(Date.UTC(year, month, day, hours, minutes));
}

module.exports = {
  getMatches,
  getMatchById,
};
async function getMatchById(match_id) {
  try {
    const { data } = await axios.get(`${vlrgg_url}/${match_id}`);
    const $ = cheerio.load(data);
    const match = $('.wf-card.match-header');
    const superDiv = match.find('.match-header-super');
    const utcDate = superDiv.find('.match-header-date .moment-tz-convert');
    const fullString = utcDate.first().text().trim() + ", " + utcDate.last().text().trim();
    const vsDiv = match.find('.match-header-vs');
    const team1Link = vsDiv.find('a.match-header-link.mod-1');
    const team2Link = vsDiv.find('a.match-header-link.mod-2');
    const team1Name = team1Link.find('.wf-title-med').text().trim();
    const team2Name = team2Link.find('.wf-title-med').text().trim();
    const team1Id = extractId(team1Link.attr('href'));
    const team2Id = extractId(team2Link.attr('href'));

    let status = vsDiv.find('.match-header-vs-note').first().text().trim().toLowerCase();
    let is_upcoming = false;
    const upcoming = vsDiv.find('.mod-upcoming');
    if (upcoming.length > 0) {
      status = "upcoming";
      is_upcoming = true;
    }

    const scoreSpans = vsDiv.find('.js-spoiler span');
    const team1Score = $(scoreSpans[0]).text().trim();
    const team2Score = $(scoreSpans[2]).text().trim();


    if (!is_upcoming && status == "final") {
      let team1_won = false;
      let team2_won = false;

      if (team1Score > team2Score) {
        team1_won = true;
      } else {
        team2_won = true;
      }
      return {
        teams: [
          {
            name: team1Name,
            id: team1Id,
            score: team1Score !== "" ? team1Score : null,
            won: team1_won
          },
          {
            name: team2Name,
            id: team2Id,
            score: team2Score !== "" ? team2Score : null,
            won: team2_won
          },
        ],
        status,
        event: null,
        tournament: null,
        img: null,
        utcDate: fullString,
      }
    } else {
      return {
        teams: [
          {
            name: team1Name,
            id: team1Id,
            score: team1Score !== "" ? team1Score : null,
          },
          {
            name: team2Name,
            id: team2Id,
            score: team2Score !== "" ? team2Score : null,
          },
        ],
        status,
        event: null,
        tournament: null,
        img: null,
        utcDate: fullString,
      }

    }

  } catch (err) {
    console.log(err);
    return
  }
}
function extractId(href) {
  if (!href) return null;
  const parts = href.split('/');
  return parts.length > 2 ? parts[2] : null;
}