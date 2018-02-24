// @flow
import Sequelize from "sequelize";
import config from "./conf";

const db = new Sequelize(`sqlite://${config.databaseFile}`, {
    operatorsAliases: Sequelize.Op
});

// TODO: remove this hack and add db.sync()
db.query("ALTER TABLE user ADD COLUMN rank INTEGER;").catch(e => {});

export default db;
