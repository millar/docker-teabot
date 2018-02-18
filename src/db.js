import Sequelize from "sequelize";
import config from "./conf";

const db = new Sequelize(`sqlite://${config.databaseFile}`, {
    operatorsAliases: Sequelize.Op
});
export default db;
