'use strict'
module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('Users', 'templates', {
      type: Sequelize.TEXT('long'),
      defaultValue: '[]'
    }).catch(function (error) {
      if (error.message.toLowerCase().includes('duplicate column name') ||
        error.message === 'column "templates" of relation "Users" already exists') {
        // eslint-disable-next-line no-console
        console.log('Migration has already run… ignoring.')
      } else {
        throw error
      }
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'templates')
  }
}
