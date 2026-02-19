import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Check, AlertCircle, X as CloseIcon, ChevronDown as ChevronDownIcon, Search } from 'lucide-react-native';
import { validatePincode } from '../../lib/pincodeValidation';

const OPERATING_CITIES = [
  'Pan India',
  'Mumbai (Maharashtra)',
  'Delhi (Delhi)',
  'Bangalore (Karnataka)',
  'Hyderabad (Telangana)',
  'Chennai (Tamil Nadu)',
  'Kolkata (West Bengal)',
  'Pune (Maharashtra)',
  'Ahmedabad (Gujarat)',
  'Jaipur (Rajasthan)',
  'Surat (Gujarat)',
  'Lucknow (Uttar Pradesh)',
  'Kanpur (Uttar Pradesh)',
  'Nagpur (Maharashtra)',
  'Indore (Madhya Pradesh)',
  'Bhopal (Madhya Pradesh)',
  'Visakhapatnam (Andhra Pradesh)',
  'Patna (Bihar)',
  'Vadodara (Gujarat)',
  'Ghaziabad (Uttar Pradesh)',
  'Ludhiana (Punjab)',
  'Agra (Uttar Pradesh)',
  'Nashik (Maharashtra)',
  'Faridabad (Haryana)',
  'Meerut (Uttar Pradesh)',
  'Rajkot (Gujarat)',
  'Varanasi (Uttar Pradesh)',
  'Goa (Goa)',
  'Udaipur (Rajasthan)',
];

interface LocationCoverageStepProps {
  data: any;
  onUpdate: (data: any) => void;
  validationErrors?: Record<string, string>;
  onFocus?: () => void;
}

export interface LocationCoverageStepRef {
  focusNextEmptyField: () => void;
}

const LocationCoverageStep = forwardRef<LocationCoverageStepRef, LocationCoverageStepProps>(({
  data,
  onUpdate,
  validationErrors = {},
  onFocus,
}, ref) => {
  const [validatingPincode, setValidatingPincode] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  // Refs for keyboard navigation
  const businessAddressRef = useRef<TextInput>(null);
  const pincodeRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const localityRef = useRef<TextInput>(null);

  // Expose method to focus next empty mandatory field
  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      if (!data.businessAddress) {
        businessAddressRef.current?.focus();
      } else if (!data.pincode || data.pincode.length !== 6) {
        pincodeRef.current?.focus();
      } else if (!data.city) {
        cityRef.current?.focus();
      } else if (!data.locality) {
        localityRef.current?.focus();
      }
    },
  }));

  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleCitySelection = (city: string) => {
    const currentLocations = data.operatingLocations || [];

    if (city === 'Pan India') {
      if (currentLocations.includes('*')) {
        handleChange('operatingLocations', []);
      } else {
        // If Pan India selected, clear all other cities and just set '*'
        handleChange('operatingLocations', ['*']);
      }
      return;
    }

    // If a normal city is selected while Pan India (*) is present, remove '*'
    let newLocations = currentLocations.filter((c: string) => c !== '*');

    if (newLocations.includes(city)) {
      handleChange('operatingLocations', newLocations.filter((c: string) => c !== city));
    } else {
      handleChange('operatingLocations', [...newLocations, city]);
    }
  };

  const filteredCities = OPERATING_CITIES.filter(city =>
    city.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  const handlePincodeChange = (text: string) => {
    // Only allow digits
    const cleanText = text.replace(/\D/g, '');
    handleChange('pincode', cleanText);

    // Reset status when typing
    if (pincodeStatus !== 'idle') {
      setPincodeStatus('idle');
      setPincodeError(null);
      setCityOptions([]);
    }
  };

  const handlePincodeBlur = async () => {
    const pincode = data.pincode;

    // Only validate if 6 digits
    if (!pincode || pincode.length !== 6) {
      if (pincode && pincode.length > 0 && pincode.length < 6) {
        setPincodeStatus('invalid');
        setPincodeError('Pincode must be 6 digits');
      }
      return;
    }

    setValidatingPincode(true);
    setPincodeError(null);

    try {
      const result = await validatePincode(pincode);

      if (result.valid) {
        setPincodeStatus('valid');

        // Set city options for dropdown
        if (result.cityOptions && result.cityOptions.length > 0) {
          setCityOptions(result.cityOptions);
        }

        // Auto-fill fields
        if (result.city) {
          handleChange('city', result.city);
        }
        if (result.locality) {
          handleChange('locality', result.locality);
        }
        if (result.state) {
          handleChange('state', result.state);
        }
      } else {
        setPincodeStatus('invalid');
        setPincodeError(result.error || 'Invalid pincode');
        setCityOptions([]);
      }
    } catch (error) {
      setPincodeStatus('invalid');
      setPincodeError('Failed to validate pincode');
      setCityOptions([]);
    } finally {
      setValidatingPincode(false);
    }
  };

  return (
    <View style={[styles.container, styles.content]}>
      <View style={styles.field}>
        <Text style={styles.label}>Business Address *</Text>
        <TextInput
          ref={businessAddressRef}
          style={[
            styles.input,
            styles.textArea,
            validationErrors.businessAddress && styles.inputError
          ]}
          value={data.businessAddress || ''}
          onChangeText={(text) => handleChange('businessAddress', text)}
          placeholder="Enter your complete business address"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="next"
          blurOnSubmit={false}
          onFocus={onFocus}
          onSubmitEditing={() => pincodeRef.current?.focus()}
        />
        {validationErrors.businessAddress && (
          <Text style={styles.errorText}>{validationErrors.businessAddress}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Pincode *</Text>
        <View style={styles.inputWithStatus}>
          <TextInput
            ref={pincodeRef}
            style={[
              styles.input,
              styles.pincodeInput,
              pincodeStatus === 'valid' && styles.inputValid,
              (pincodeStatus === 'invalid' || validationErrors.pincode) && styles.inputInvalid,
            ]}
            value={data.pincode || ''}
            onChangeText={handlePincodeChange}
            onBlur={handlePincodeBlur}
            placeholder="Enter 6-digit pincode"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={6}
            returnKeyType="next"
            onFocus={onFocus}
            onSubmitEditing={() => {
              // If city is a TextInput, focus it; otherwise focus locality
              if (cityOptions.length <= 1 && cityRef.current) {
                cityRef.current.focus();
              } else if (localityRef.current) {
                localityRef.current.focus();
              }
            }}
          />
          <View style={styles.statusIcon}>
            {validatingPincode && (
              <ActivityIndicator size="small" color="#007AFF" />
            )}
            {!validatingPincode && pincodeStatus === 'valid' && (
              <Check size={20} color="#34C759" />
            )}
            {!validatingPincode && pincodeStatus === 'invalid' && (
              <AlertCircle size={20} color="#FF3B30" />
            )}
          </View>
        </View>
        {(pincodeError || validationErrors.pincode) && (
          <Text style={styles.errorText}>{pincodeError || validationErrors.pincode}</Text>
        )}
        {pincodeStatus === 'valid' && !validationErrors.pincode && (
          <Text style={styles.successText}>
            Pincode verified - Location details auto-filled
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Area *</Text>
        <TextInput
          ref={cityRef}
          style={[
            styles.input,
            validationErrors.city && styles.inputError
          ]}
          value={data.city || ''}
          onChangeText={(text) => handleChange('city', text)}
          placeholder="Enter area"
          placeholderTextColor="#999"
          returnKeyType="next"
          onFocus={onFocus}
          onSubmitEditing={() => localityRef.current?.focus()}
        />
        {cityOptions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Suggestions:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
              {cityOptions.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.suggestionChip,
                    data.city === city && styles.suggestionChipSelected
                  ]}
                  onPress={() => handleChange('city', city)}
                >
                  <Text style={[
                    styles.suggestionChipText,
                    data.city === city && styles.suggestionChipTextSelected
                  ]}>
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {validationErrors.city && (
          <Text style={styles.errorText}>{validationErrors.city}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>City/Town</Text>
        <TextInput
          ref={localityRef}
          style={styles.input}
          value={data.locality || ''}
          onChangeText={(text) => handleChange('locality', text)}
          placeholder="Enter city/town"
          placeholderTextColor="#999"
          returnKeyType="next"
          onFocus={onFocus}
          onSubmitEditing={() => setIsCityModalOpen(true)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Operating Locations *</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.dropdownTrigger,
            validationErrors.operatingLocations && styles.inputError
          ]}
          onPress={() => setIsCityModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.dropdownText,
            (!data.operatingLocations || data.operatingLocations.length === 0) && styles.placeholder
          ]}>
            {data.operatingLocations && data.operatingLocations.length > 0
              ? `${data.operatingLocations.length} locations selected`
              : 'Select operating locations'}
          </Text>
          <ChevronDownIcon size={20} color="#666" />
        </TouchableOpacity>

        {data.operatingLocations && data.operatingLocations.length > 0 && (
          <View style={styles.selectedContainer}>
            {data.operatingLocations.map((city: string) => (
              <View key={city} style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{city === '*' ? 'Pan India' : city}</Text>
                <TouchableOpacity
                  onPress={() => toggleCitySelection(city === '*' ? 'Pan India' : city)}
                  style={styles.removeButton}
                >
                  <CloseIcon size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {validationErrors.operatingLocations && (
          <Text style={styles.errorText}>{validationErrors.operatingLocations}</Text>
        )}
      </View>

      {/* City Selection Modal */}
      <Modal
        visible={isCityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Operating Locations</Text>
              <TouchableOpacity
                onPress={() => setIsCityModalOpen(false)}
                style={styles.closeButton}
              >
                <CloseIcon size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search cities..."
                placeholderTextColor="#999"
                value={citySearchQuery}
                onChangeText={setCitySearchQuery}
              />
            </View>

            <ScrollView style={styles.optionsList}>
              {filteredCities.map((city) => {
                const isSelected = data.operatingLocations?.includes(city);
                return (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected
                    ]}
                    onPress={() => toggleCitySelection(city)}
                  >
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected
                    ]}>
                      {city}
                    </Text>
                    {isSelected || (city === 'Pan India' && data.operatingLocations?.includes('*')) ? (
                      <View style={styles.checkmark}>
                        <Check size={14} color="#fff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setIsCityModalOpen(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Enter your pincode to auto-fill city, locality, and state. This helps customers find vendors in their area.
        </Text>
      </View>
    </View>
  );
});

LocationCoverageStep.displayName = 'LocationCoverageStep';

export default LocationCoverageStep;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  textArea: {
    height: 100,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputValid: {
    borderColor: '#34C759',
  },
  inputInvalid: {
    borderColor: '#FF3B30',
  },
  inputWithStatus: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pincodeInput: {
    flex: 1,
  },
  statusIcon: {
    position: 'absolute',
    right: 12,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  successText: {
    color: '#34C759',
    fontSize: 12,
    marginTop: 4,
  },
  suggestionsContainer: {
    marginTop: 8,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  suggestionsScroll: {
    paddingBottom: 4,
  },
  suggestionChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  suggestionChipText: {
    fontSize: 13,
    color: '#1a1a1a',
  },
  suggestionChipTextSelected: {
    color: '#fff',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  placeholder: {
    color: '#999',
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedChipText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 6,
  },
  removeButton: {
    padding: 2,
  },
  infoBox: {
    backgroundColor: '#f0f7ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  infoText: {
    fontSize: 13,
    color: '#007AFF',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    margin: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1a1a1a',
  },
  optionsList: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#f0f7ff',
  },
  optionText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 2,
  },
  modalFooter: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
