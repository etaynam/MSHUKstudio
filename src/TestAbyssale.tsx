import React, { useState, useEffect, useCallback } from 'react';
import './TestAbyssale.css';

interface Design {
  id: string;
  name: string;
  created_at?: string;
}

interface DesignDetails {
  id: string;
  name: string;
  elements?: Record<string, {
    type?: string;
    default?: string;
    [key: string]: any;
  }>;
  formats?: any[];
}

const TestAbyssale: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string>('');
  const [designDetails, setDesignDetails] = useState<DesignDetails | null>(null);
  const [loadingDesigns, setLoadingDesigns] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [elementValues, setElementValues] = useState<Record<string, string>>({});
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // טעינת רשימת תבניות כשמכניסים API Key
  const loadDesigns = useCallback(async () => {
    if (!apiKey.trim()) {
      setDesigns([]);
      setSelectedDesignId('');
      setDesignDetails(null);
      return;
    }

    setLoadingDesigns(true);
    setError(null);

    try {
      const response = await fetch('https://api.abyssale.com/designs', {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `שגיאה ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDesigns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת התבניות');
      setDesigns([]);
    } finally {
      setLoadingDesigns(false);
    }
  }, [apiKey]);

  // טעינת פרטי תבנית נבחרת
  const loadDesignDetails = useCallback(async (designId: string) => {
    if (!apiKey.trim() || !designId) {
      setDesignDetails(null);
      setElementValues({});
      return;
    }

    setLoadingDetails(true);
    setError(null);

    try {
      const response = await fetch(`https://api.abyssale.com/designs/${designId}`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `שגיאה ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Debug: הצג את כל התגובה בקונסול
      console.log('Full API Response:', JSON.stringify(data, null, 2));
      
      setDesignDetails(data);
      
      // איפוס ערכי האלמנטים
      // נחפש elements ב-data או ב-layers או בכל מקום אחר
      const initialValues: Record<string, string> = {};
      
      // נסה למצוא elements במבנים שונים
      let elementsToUse: Record<string, any> = {};
      
      if (data.elements) {
        elementsToUse = data.elements;
      } else if (data.layers) {
        // אם יש layers, נמיר אותם ל-elements
        data.layers.forEach((layer: any, index: number) => {
          const key = layer.name || layer.id || `layer_${index}`;
          elementsToUse[key] = {
            type: layer.type || 'text',
            default: layer.default || layer.content || '',
            name: layer.name,
            ...layer
          };
        });
      } else if (data.formats && data.formats.length > 0) {
        // אולי elements נמצאים בתוך format
        const firstFormat = data.formats[0];
        if (firstFormat.elements) {
          elementsToUse = firstFormat.elements;
        } else if (firstFormat.layers) {
          firstFormat.layers.forEach((layer: any, index: number) => {
            const key = layer.name || layer.id || `layer_${index}`;
            elementsToUse[key] = {
              type: layer.type || 'text',
              default: layer.default || layer.content || '',
              name: layer.name,
              ...layer
            };
          });
        }
      }
      
      Object.keys(elementsToUse).forEach(key => {
        initialValues[key] = '';
      });
      setElementValues(initialValues);
      
      // עדכן את designDetails עם elements שנמצאו
      setDesignDetails({
        ...data,
        elements: elementsToUse
      });
      
      // איפוס בחירת שכבות
      setSelectedElements(new Set());
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת פרטי התבנית');
      setDesignDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  }, [apiKey]);

  // טעינת תבניות כשמשנים API Key
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDesigns();
    }, 500); // debounce

    return () => clearTimeout(timer);
  }, [apiKey, loadDesigns]);

  // טעינת פרטי תבנית כשמשנים בחירה
  useEffect(() => {
    if (selectedDesignId) {
      loadDesignDetails(selectedDesignId);
    } else {
      setDesignDetails(null);
      setElementValues({});
    }
  }, [selectedDesignId, loadDesignDetails]);

  const handleElementChange = (elementName: string, value: string) => {
    setElementValues(prev => ({
      ...prev,
      [elementName]: value,
    }));
  };

  const handleElementToggle = (elementKey: string) => {
    setSelectedElements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(elementKey)) {
        newSet.delete(elementKey);
        // מחק את הערך אם הסרנו את הבחירה
        setElementValues(prevValues => {
          const newValues = { ...prevValues };
          delete newValues[elementKey];
          return newValues;
        });
      } else {
        newSet.add(elementKey);
        // אתחל ערך ריק אם הוספנו בחירה
        setElementValues(prevValues => ({
          ...prevValues,
          [elementKey]: '',
        }));
      }
      return newSet;
    });
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('נא להזין API Key');
      return;
    }
    if (!selectedDesignId.trim()) {
      setError('נא לבחור תבנית');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      // בניית elements object מהערכים שהמשתמש הזין (רק שכבות שנבחרו)
      const elements: Record<string, any> = {};
      
      Object.entries(elementValues).forEach(([key, value]) => {
        // רק שכבות שנבחרו ונמצאות ב-selectedElements
        if (selectedElements.has(key) && value.trim()) {
          const elementInfo = designDetails?.elements?.[key];
          const elementType = elementInfo?.type || 'text';
          const overrideKey = elementInfo?.name || key;
          
          if (elementType === 'image' || overrideKey.toLowerCase().includes('image')) {
            elements[overrideKey] = {
              image_url: value,
              url: value
            };
          } else {
            elements[overrideKey] = { payload: value };
          }
        }
      });

      const requestBody: any = {};
      if (Object.keys(elements).length > 0) {
        requestBody.elements = elements;
      }

      console.log('Abyssale request body:', requestBody);

      const response = await fetch(
        `https://api.abyssale.com/banner-builder/${selectedDesignId}/generate`,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `שגיאה ${response.status}: ${response.statusText}`);
      }

      const imageUrl =
        data?.file?.cdn_url ||
        data?.file?.url ||
        data?.image?.url ||
        data?.url;

      if (imageUrl) {
        setGeneratedImageUrl(imageUrl);
      }
      console.log('Abyssale response:', data);
    } catch (err: any) {
      setError(err.message || 'שגיאה בלתי צפויה בעת יצירת הגרפיקה');
    } finally {
      setLoading(false);
    }
  };

  const getElementLabel = (elementKey: string, elementInfo: any): string => {
    // השם האמיתי של השכבה (שנתת ב-Abyssale)
    const displayName = elementInfo?.name || elementKey;
    if (elementInfo?.default) {
      return `${displayName} (ברירת מחדל: ${elementInfo.default})`;
    }
    return displayName;
  };

  return (
    <div className="test-abyssale-container">
      <div className="test-abyssale-content">
        <h1>טסט Abyssale API</h1>
        <p className="subtitle">בדיקת חיבור ויצירת גרפיקה דרך API</p>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="apiKey">API Key *</label>
            <input
              id="apiKey"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="הזן את ה-API Key שלך"
              className="form-input"
            />
            {loadingDesigns && <div className="loading-text">טוען תבניות...</div>}
          </div>

          <div className="form-group">
            <label htmlFor="designSelect">בחר תבנית *</label>
            <select
              id="designSelect"
              value={selectedDesignId}
              onChange={(e) => setSelectedDesignId(e.target.value)}
              className="form-input"
              disabled={!apiKey.trim() || loadingDesigns || designs.length === 0}
            >
              <option value="">-- בחר תבנית --</option>
              {designs.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name}
                </option>
              ))}
            </select>
            {loadingDetails && <div className="loading-text">טוען פרטי תבנית...</div>}
          </div>

          {/* הצגת שמות המשתנים עם אפשרות בחירה */}
          {designDetails && designDetails.elements && (
            <div className="elements-info">
              <h3>בחר אילו שכבות לשנות:</h3>
              <div className="elements-list">
                {Object.keys(designDetails.elements).map((elementKey) => {
                  const elementInfo = designDetails.elements![elementKey];
                  const elementType = elementInfo?.type || 'text';
                  // השם האמיתי של השכבה (שנתת ב-Abyssale) או המפתח
                  const displayName = elementInfo?.name || elementKey;
                  const isSelected = selectedElements.has(elementKey);
                  return (
                    <div 
                      key={elementKey} 
                      className={`element-item ${isSelected ? 'selected' : ''}`}
                      title={`מפתח API: ${elementKey}`}
                    >
                      <label className="element-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleElementToggle(elementKey)}
                          className="element-checkbox"
                        />
                        <code className="element-name">{displayName}</code>
                        <span className="element-type">({elementType})</span>
                        {elementInfo?.name && elementKey !== elementInfo.name && (
                          <span className="element-key-hint" title={`מפתח API: ${elementKey}`}>
                            [{elementKey}]
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* טופס דינמי לפי האלמנטים שנבחרו */}
          {designDetails && designDetails.elements && selectedElements.size > 0 && (
            <div className="dynamic-form">
              <h3>הזן ערכים לאלמנטים שנבחרו:</h3>
              {Array.from(selectedElements).map((elementKey) => {
                const elementInfo = designDetails.elements![elementKey];
                const elementType = elementInfo?.type || 'text';
                const overrideKey = elementInfo?.name || elementKey;
                const isImage = elementType === 'image' || overrideKey.toLowerCase().includes('image');
                const displayName = elementInfo?.name || elementKey;
                
                return (
                  <div key={elementKey} className="form-group">
                    <label htmlFor={`element-${elementKey}`}>
                      {getElementLabel(elementKey, elementInfo)}
                      {elementInfo?.name && elementKey !== elementInfo.name && (
                        <span className="element-key-label"> (מפתח: {elementKey})</span>
                      )}
                    </label>
                    {isImage ? (
                      <input
                        id={`element-${elementKey}`}
                        type="url"
                        value={elementValues[elementKey] || ''}
                        onChange={(e) => handleElementChange(elementKey, e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="form-input"
                      />
                    ) : (
                      <input
                        id={`element-${elementKey}`}
                        type="text"
                        value={elementValues[elementKey] || ''}
                        onChange={(e) => handleElementChange(elementKey, e.target.value)}
                        placeholder={`הזן ערך ל-${displayName}`}
                        className="form-input"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {designDetails && designDetails.elements && selectedElements.size === 0 && (
            <div className="no-selection-message">
              <p>בחר שכבות מהרשימה למעלה כדי להזין ערכים</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !apiKey.trim() || !selectedDesignId.trim() || selectedElements.size === 0}
            className="generate-button"
          >
            {loading ? 'יוצר גרפיקה...' : 'צור גרפיקת טסט'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>שגיאה:</strong> {error}
          </div>
        )}

        {generatedImageUrl && (
          <div className="result-section">
            <h2>הגרפיקה שנוצרה:</h2>
            <div className="image-container">
              <img
                src={generatedImageUrl}
                alt="Generated graphic"
                className="generated-image"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TestAbyssale;
