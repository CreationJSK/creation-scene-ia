// On utilise la syntaxe d'importation moderne (ESM)
import fetch from 'node-fetch';

const handler = async (event) => {
    console.log("--- La fonction 'generer-scene' a été déclenchée ---");

    if (event.httpMethod !== 'POST') {
        console.log("Erreur : Méthode non autorisée. Reçue :", event.httpMethod);
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        console.log("Tentative de lecture du corps de la requête...");
        const { sceneData, subjectData, scaleInstructions } = JSON.parse(event.body);
        console.log("Corps de la requête lu avec succès.");

        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.error("ERREUR CRITIQUE : La variable d'environnement GOOGLE_API_KEY est manquante !");
            throw new Error('La clé API n\'est pas configurée sur le serveur.');
        }
        console.log("Clé API trouvée.");

        const basePrompt = `À partir de la deuxième image (le sujet), découpe précisément le sujet principal et supprime complètement son arrière-plan. Ensuite, place ce sujet découpé de manière réaliste sur la première image (la scène). Assure-toi que l'intégration soit harmonieuse.`;
        const finalPrompt = scaleInstructions 
            ? `${basePrompt} ${scaleInstructions}. Fournis uniquement l'image finale composée en sortie.` 
            : `${basePrompt} Fournis uniquement l'image finale composée en sortie.`;

        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { text: finalPrompt },
                    { inlineData: { mimeType: "image/png", data: sceneData } },
                    { inlineData: { mimeType: "image/png", data: subjectData } }
                ]
            }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            },
        };

        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
        
        console.log("Appel de l'API Google...");
        const apiResponse = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("Réponse de Google reçue. Statut :", apiResponse.status);

        if (!apiResponse.ok) {
            const errorResult = await apiResponse.json();
            console.error('Erreur API Google:', errorResult);
            throw new Error(errorResult.error?.message || `Erreur API Google: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (!base64Data) {
            console.error("Aucune image trouvée dans la réponse de Google.");
            throw new Error("Aucune donnée d'image trouvée dans la réponse de Google.");
        }
        console.log("Image générée avec succès.");

        return {
            statusCode: 200,
            body: JSON.stringify({ base64Data: base64Data })
        };

    } catch (error) {
        console.error('--- ERREUR DANS LA FONCTION ---:', error);
        // --- MODIFICATION IMPORTANTE ---
        // On renvoie une réponse d'erreur très simple pour éviter les problèmes de formatage.
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Une erreur interne est survenue dans la fonction. Consultez les logs Netlify pour les détails." })
        };
    }
};

export { handler };

