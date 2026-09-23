const app = require('../backend/server');
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🏥 MedPulse Community Health Platform (MVC Architecture)`);
        console.log(`🚀 Server running at: http://localhost:${PORT}`);
        console.log(`====================================================`);
    });
}

module.exports = app;
