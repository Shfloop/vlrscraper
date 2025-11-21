const matchesService = require("../services/matchesService");
const catchError = require("../utils/catchError");

const getMatches = async (req, res) => {
  try {
    const { size, matches } = await matchesService.getMatches();

    res.status(200).json({
      status: "OK",
      size,
      data: matches,
    });
  } catch (error) { }
};
const getMatchById = async (req, res) => {
  const { id } = req.params;
  try {

    const match = await matchesService.getMatchById(id);

    res.status(200).json({
      status: "OK",

      data: match,
    });
  } catch (error) { }
};

module.exports = {
  getMatches,
  getMatchById,
};
