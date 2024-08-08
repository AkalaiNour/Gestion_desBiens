// authMiddleware.js
function authMiddleware(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.status(401).redirect('/Connexion.html');
    }
}

module.exports = authMiddleware;
