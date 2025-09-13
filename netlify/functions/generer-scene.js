// On utilise la syntaxe d'importation moderne (ESM)
import fetch from 'node-fetch';

const handler = async (event) => {
    // On n'autorise que les requêtes POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { sceneData, subjectData, scaleInstructions } = JSON.parse(event.body);

        // On récupère la clé API secrète depuis les variables d'environnement de Netlify
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            throw new Error('La clé API n\'est pas configurée sur le serveur.');
        }

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

        const apiResponse = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorResult = await apiResponse.json();
            console.error('Erreur API Google:', errorResult);
            throw new Error(errorResult.error?.message || `Erreur API Google: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (!base64Data) {
            throw new Error("Aucune donnée d'image trouvée dans la réponse de Google.");
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ base64Data: base64Data })
        };

    } catch (error) {
        console.error('Erreur de la fonction:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

export { handler };

