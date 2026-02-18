import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react-native';
import { supabaseCore } from '../../lib/supabase';
import { pickDocuments, DocumentFile, isImageFile, isPdfFile } from '../../lib/documentUpload';

interface VerificationStepProps {
  data: any;
  onUpdate: (data: any) => void;
  validationErrors?: Record<string, string>;
  onFocus?: () => void;
}

export interface VerificationStepRef {
  focusNextEmptyField: () => void;
}

interface DocumentType {
  id: string;
  type_code: string;
  display_name: string;
}

interface DocumentGroup {
  typeCode: string;
  typeName: string;
  files: DocumentFile[];
}

const VerificationStep = forwardRef<VerificationStepRef, VerificationStepProps>(({
  data,
  onUpdate,
  validationErrors = {},
  onFocus,
}, ref) => {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // typeCode of document being uploaded


  // Refs for keyboard navigation
  const panNumberRef = useRef<TextInput>(null);
  const gstNumberRef = useRef<TextInput>(null);

  // Expose method to focus next empty mandatory field
  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      if (!data.panNumber || !data.panNumber.trim()) {
        panNumberRef.current?.focus();
      } else {
        // PAN document upload - can't focus directly, but we can scroll to it
        // For now, just focus PAN number if it's empty
      }
    },
  }));

  // Document types we need to support (PAN is first and mandatory)
  const requiredDocumentTypeCodes = ['pan', 'gst', 'aadhaar', 'bank_statement', 'general', 'business_license'];
  const mandatoryDocumentTypes = ['pan'];

  // Initialize document groups from data or create empty ones
  const [documentGroups, setDocumentGroups] = useState<DocumentGroup[]>(() => {
    return requiredDocumentTypeCodes.map((code) => ({
      typeCode: code,
      typeName: '',
      files: data.verificationDocuments?.[code] || [],
    }));
  });

  useEffect(() => {
    loadDocumentTypes();

  }, []);

  const loadDocumentTypes = async () => {
    try {
      setLoadingTypes(true);
      const { data: types, error } = await supabaseCore
        .from('document_types')
        .select('id, type_code, display_name')
        .in('type_code', requiredDocumentTypeCodes)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading document types:', error);
        return;
      }

      if (types) {
        setDocumentTypes(types);
        // Update document groups with display names
        setDocumentGroups((prev) =>
          prev.map((group) => {
            const type = types.find((t) => t.type_code === group.typeCode);
            return {
              ...group,
              typeName: type?.display_name || group.typeCode,
            };
          })
        );
      }
    } catch (error) {
      console.error('Error loading document types:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  const handlePickDocuments = async (typeCode: string) => {
    try {
      setUploading(typeCode);
      const { files, error } = await pickDocuments(true);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (files.length === 0) {
        return;
      }

      // Add files to the appropriate document group
      setDocumentGroups((prev) => {
        const updated = prev.map((group) => {
          if (group.typeCode === typeCode) {
            return {
              ...group,
              files: [...group.files, ...files],
            };
          }
          return group;
        });

        // Update parent data
        const documentsMap: Record<string, DocumentFile[]> = {};
        updated.forEach((group) => {
          documentsMap[group.typeCode] = group.files;
        });
        onUpdate({ verificationDocuments: documentsMap });

        return updated;
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to pick documents');
      console.error('Error picking documents:', error);
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveDocument = (typeCode: string, index: number) => {
    setDocumentGroups((prev) => {
      const updated = prev.map((group) => {
        if (group.typeCode === typeCode) {
          const newFiles = [...group.files];
          newFiles.splice(index, 1);
          return {
            ...group,
            files: newFiles,
          };
        }
        return group;
      });

      // Update parent data
      const documentsMap: Record<string, DocumentFile[]> = {};
      updated.forEach((group) => {
        documentsMap[group.typeCode] = group.files;
      });
      onUpdate({ verificationDocuments: documentsMap });

      return updated;
    });
  };

  const renderDocumentPreview = (file: DocumentFile, typeCode: string, index: number) => {
    const isImage = isImageFile(file.type || '');
    const isPdf = isPdfFile(file.type || '');

    return (
      <View key={index} style={styles.documentPreview}>
        {isImage && file.uri ? (
          <Image source={{ uri: file.uri }} style={styles.documentImage} />
        ) : (
          <View style={styles.documentIcon}>
            <FileText size={24} color="#666" />
          </View>
        )}
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {file.name || (isPdf ? 'PDF Document' : 'Image')}
          </Text>
          {file.size && (
            <Text style={styles.documentSize}>
              {(file.size / 1024).toFixed(1)} KB
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveDocument(typeCode, index)}
        >
          <X size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loadingTypes) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading document types...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.content]}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Get Verified, Get Noticed</Text>
        <Text style={styles.infoText}>
          Verified businesses earn more trust — and more bookings.{'\n\n'}
          ✅ Customers prefer verified vendors{'\n'}
          📈 Rank higher in search results{'\n'}
          ⭐ Unlock premium features & badges{'\n'}
          🔒 Protect your brand from impersonation
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>PAN *</Text>
        <Text style={styles.hint}>Required - Permanent Account Number</Text>
        <View style={styles.inputActionRow}>
          <TextInput
            ref={panNumberRef}
            style={[
              styles.input,
              styles.flexInput,
              validationErrors.panNumber && styles.inputError
            ]}
            value={data.panNumber || ''}
            onChangeText={(text) => handleChange('panNumber', text)}
            placeholder="Enter PAN"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={10}
            returnKeyType="next"
            onFocus={onFocus}
            onSubmitEditing={() => gstNumberRef.current?.focus()}
          />
          <TouchableOpacity
            style={[
              styles.inlineUploadButton,
              uploading === 'pan' && styles.uploadButtonDisabled,
              validationErrors.panDocument && styles.uploadButtonError
            ]}
            onPress={() => handlePickDocuments('pan')}
            disabled={uploading === 'pan'}
          >
            {uploading === 'pan' ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <>
                <Upload size={18} color={validationErrors.panDocument ? '#FF3B30' : '#007AFF'} />
                <Text style={[styles.inlineUploadButtonText, validationErrors.panDocument && styles.uploadButtonTextError]}>
                  Add PAN
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {validationErrors.panNumber && (
          <Text style={styles.errorText}>{validationErrors.panNumber}</Text>
        )}
        {validationErrors.panDocument && (
          <Text style={styles.errorText}>{validationErrors.panDocument}</Text>
        )}

        {/* PAN Document Preview */}
        {data.verificationDocuments?.['pan']?.length > 0 && (
          <View style={styles.documentsList}>
            {data.verificationDocuments['pan'].map((file: any, index: number) =>
              renderDocumentPreview(file, 'pan', index)
            )}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>GST Number</Text>
        <View style={styles.inputActionRow}>
          <TextInput
            ref={gstNumberRef}
            style={[styles.input, styles.flexInput]}
            value={data.gstNumber || ''}
            onChangeText={(text) => handleChange('gstNumber', text)}
            placeholder="Enter GST number"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={15}
            returnKeyType="done"
            onFocus={onFocus}
          />
          <TouchableOpacity
            style={[
              styles.inlineUploadButton,
              uploading === 'gst' && styles.uploadButtonDisabled
            ]}
            onPress={() => handlePickDocuments('gst')}
            disabled={uploading === 'gst'}
          >
            {uploading === 'gst' ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <>
                <Upload size={18} color="#007AFF" />
                <Text style={styles.inlineUploadButtonText}>
                  Add GST Cert
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* GST Document Preview */}
        {data.verificationDocuments?.['gst']?.length > 0 && (
          <View style={styles.documentsList}>
            {data.verificationDocuments['gst'].map((file: any, index: number) =>
              renderDocumentPreview(file, 'gst', index)
            )}
          </View>
        )}
      </View>

      {/* Other Document Upload Sections */}
      {documentGroups.filter(g => g.typeCode !== 'pan' && g.typeCode !== 'gst').map((group) => {
        const typeName = group.typeName || group.typeCode;
        const isUploading = uploading === group.typeCode;
        const isMandatory = mandatoryDocumentTypes.includes(group.typeCode);
        const hasError = isMandatory && group.typeCode === 'pan' && validationErrors.panDocument;

        return (
          <View key={group.typeCode} style={styles.field}>
            <Text style={styles.label}>{typeName} {isMandatory ? '*' : ''}</Text>

            {/* Uploaded Documents */}
            {group.files.length > 0 && (
              <View style={styles.documentsList}>
                {group.files.map((file, index) =>
                  renderDocumentPreview(file, group.typeCode, index)
                )}
              </View>
            )}

            {/* Error message for PAN document */}
            {hasError && (
              <Text style={styles.errorText}>{validationErrors.panDocument}</Text>
            )}

            {/* Upload Button */}
            <TouchableOpacity
              style={[
                styles.uploadButton,
                isUploading && styles.uploadButtonDisabled,
                hasError && styles.uploadButtonError
              ]}
              onPress={() => handlePickDocuments(group.typeCode)}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Upload size={20} color={hasError ? "#FF3B30" : "#007AFF"} />
              )}
              <Text style={[styles.uploadButtonText, hasError && styles.uploadButtonTextError]}>
                {isUploading ? 'Uploading...' : `Add ${typeName}`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

    </ScrollView>
  );
});

VerificationStep.displayName = 'VerificationStep';

export default VerificationStep;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  mandatoryHint: {
    color: '#cc6600',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#fff5f5',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonError: {
    backgroundColor: '#fff5f5',
    borderColor: '#FF3B30',
    borderWidth: 2,
    borderStyle: 'solid',
  },
  uploadButtonTextError: {
    color: '#FF3B30',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  flexInput: {
    flex: 1,
    minWidth: 150, // Break to next line if less than this
  },
  inlineUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inlineUploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  documentsList: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  documentImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0066cc',
    lineHeight: 20,
  },
  tipBox: {
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#996600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#996600',
    lineHeight: 22,
  },
});
