import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import i18n from "./src/i18n";
import LanguageSelector from "./src/components/LanguageSelector";

const BASE_URL = "http://192.168.29.18:5000";

export default function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectingImage, setSelectingImage] = useState(false);
  const [result, setResult] = useState(null);

  const pickImage = async (fromCamera = false) => {
    setSelectingImage(true);
    try {
      let permission;

      if (fromCamera) {
        permission = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permission.granted) {
        Alert.alert(i18n.t('app.title'), i18n.t('alerts.permissionRequired'));
        return;
      }

      const pickerFn = fromCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const res = await pickerFn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!res.canceled) {
        setImage(res.assets[0]);
        setResult(null);
      }
    } catch (error) {
      Alert.alert(i18n.t('app.title'), "Failed to pick image");
    } finally {
      setSelectingImage(false);
    }
  };

  const checkServerHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  };

  const analyzeDisease = async () => {
    if (!image) {
      Alert.alert(i18n.t('app.title'), i18n.t('alerts.noImage'));
      return;
    }

    const isServerHealthy = await checkServerHealth();
    if (!isServerHealthy) {
      Alert.alert(i18n.t('app.title'), i18n.t('alerts.serverUnavailable'));
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("image", {
        uri: image.uri,
        name: "crop.jpg",
        type: "image/jpeg",
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(`${BASE_URL}/detect-disease`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success === false) {
        throw new Error(data.error || "Detection failed");
      }
      
      setResult(data);
    } catch (err) {
      if (err.name === 'AbortError') {
        Alert.alert(i18n.t('app.title'), i18n.t('alerts.timeout'));
      } else {
        Alert.alert(
          i18n.t('app.title'), 
          err.message || i18n.t('alerts.analysisFailed')
        );
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const openProductLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(i18n.t('app.title'), i18n.t('alerts.cannotOpenLink'));
      }
    } catch (error) {
      Alert.alert(i18n.t('app.title'), i18n.t('alerts.failedToOpenLink'));
    }
  };

  const clearResults = () => {
    setImage(null);
    setResult(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('app.title')}</Text>
        <LanguageSelector />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>{i18n.t('app.subtitle')}</Text>

        {image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image.uri }} style={styles.image} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={clearResults}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => pickImage(false)}
            disabled={selectingImage || loading}
          >
            {selectingImage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>{i18n.t('buttons.uploadImage')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => pickImage(true)}
            disabled={selectingImage || loading}
          >
            {selectingImage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>{i18n.t('buttons.clickPhoto')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.analyzeBtn, 
            (!image || loading) && styles.disabled
          ]}
          onPress={analyzeDisease}
          disabled={!image || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyzeText}>{i18n.t('buttons.analyzeDisease')}</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>{i18n.t('results.plantCrop')}</Text>
            <Text style={styles.cropText}>{result.crop}</Text>

            <Text style={styles.resultTitle}>
              {result.isHealthy ? i18n.t('results.status') : i18n.t('results.diseaseDetected')}
            </Text>
            <Text style={result.isHealthy ? styles.healthyText : styles.diseaseText}>
              {result.disease}
            </Text>

            {result.confidence && (
              <>
                <Text style={styles.resultTitle}>{i18n.t('results.confidence')}</Text>
                <View style={styles.confidenceBar}>
                  <View 
                    style={[
                      styles.confidenceFill, 
                      { 
                        width: `${result.confidence * 100}%`,
                        backgroundColor: result.isHealthy ? '#198754' : '#ffc107'
                      }
                    ]} 
                  />
                  <Text style={styles.confidenceText}>
                    {(result.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.resultTitle}>{i18n.t('results.description')}</Text>
            <Text style={styles.resultText}>{result.description}</Text>

            {result.isHealthy && result.growth_tips && (
              <>
                <Text style={styles.resultTitle}>{i18n.t('results.growthTips')}</Text>
                {result.growth_tips.map((item, index) => (
                  <Text key={index} style={styles.resultText}>
                    • {item}
                  </Text>
                ))}
              </>
            )}

            {!result.isHealthy && result.prevention && (
              <>
                <Text style={styles.resultTitle}>{i18n.t('results.prevention')}</Text>
                {result.prevention.map((item, index) => (
                  <Text key={index} style={styles.resultText}>
                    • {item}
                  </Text>
                ))}
              </>
            )}

            {result.recommended_products && result.recommended_products.length > 0 && (
              <>
                <Text style={styles.resultTitle}>
                  {result.isHealthy ? i18n.t('results.productsForGrowth') : i18n.t('results.treatmentProducts')}
                </Text>
                {result.recommended_products.map((product, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.productLink}
                    onPress={() => openProductLink(product.url)}
                  >
                    <Text style={styles.productTitle}>🔗 {product.title}</Text>
                    <Text style={styles.productUrl} numberOfLines={1}>
                      {product.url}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {result.articles && result.articles.length > 0 && (
              <>
                <Text style={styles.resultTitle}>{i18n.t('results.articles')}</Text>
                {result.articles.map((article, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.articleLink}
                    onPress={() => openProductLink(article.url)}
                  >
                    <Text style={styles.articleTitle}>📄 {article.title}</Text>
                    <Text style={styles.articleUrl} numberOfLines={1}>
                      {article.url}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8f9fa" 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    flex: 1,
  },
  content: { 
    padding: 20, 
    paddingBottom: 40 
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#7f8c8d",
    marginBottom: 20,
  },
  imageContainer: {
    position: "relative",
    marginBottom: 15,
    borderRadius: 10,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: "100%",
    height: 220,
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(220, 53, 69, 0.8)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  removeImageText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  button: {
    backgroundColor: "#5147f3",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#5147f3",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "600",
    fontSize: 15,
  },
  analyzeBtn: {
    backgroundColor: "#198754",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 25,
    elevation: 3,
    shadowColor: "#198754",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  analyzeText: { 
    color: "#fff", 
    fontWeight: "700",
    fontSize: 16,
  },
  disabled: { 
    opacity: 0.6,
  },
  resultBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    marginBottom: 20,
  },
  resultTitle: {
    fontWeight: "700",
    marginTop: 18,
    fontSize: 16,
    color: "#2c3e50",
    marginBottom: 6,
  },
  resultText: {
    marginTop: 4,
    color: "#495057",
    fontSize: 14,
    lineHeight: 20,
  },
  cropText: {
    marginTop: 2,
    color: "#198754",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  diseaseText: {
    marginTop: 2,
    color: "#dc3545",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  healthyText: {
    marginTop: 2,
    color: "#198754",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  confidenceBar: {
    marginTop: 10,
    height: 32,
    backgroundColor: "#e9ecef",
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  confidenceFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#198754",
    borderRadius: 16,
  },
  confidenceText: {
    textAlign: "center",
    fontWeight: "700",
    color: "#212529",
    zIndex: 1,
    fontSize: 14,
  },
  productLink: {
    backgroundColor: "#f0f8ff",
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "#5147f3",
    marginBottom: 8,
  },
  productTitle: {
    color: "#5147f3",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 6,
  },
  productUrl: {
    color: "#6c757d",
    fontSize: 11,
    fontFamily: "monospace",
  },
  articleLink: {
    backgroundColor: "#fff3cd",
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "#ffc107",
    marginBottom: 8,
  },
  articleTitle: {
    color: "#856404",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 6,
  },
  articleUrl: {
    color: "#6c757d",
    fontSize: 11,
    fontFamily: "monospace",
  },
});
