/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// DataType defines the type of dataset
// +kubebuilder:validation:Enum=raw;train;eval;model
type DataType string

const (
	DataTypeRaw   DataType = "raw"
	DataTypeTrain DataType = "train"
	DataTypeEval  DataType = "eval"
	DataTypeModel DataType = "model"
)

// RLDatasetSpec defines the desired state of RLDataset
type RLDatasetSpec struct {
	// ExperimentID is the ID of the experiment this dataset belongs to
	// +kubebuilder:validation:Required
	ExperimentID string `json:"experimentId"`

	// DataType specifies the type of data (raw, train, eval, model)
	// +kubebuilder:validation:Required
	DataType DataType `json:"dataType"`

	// Description provides additional information about the dataset
	// +kubebuilder:validation:Optional
	Description string `json:"description,omitempty"`

	// StoragePath is the path in CFS where the dataset is stored
	// Format: /cfs/rl-data/{experimentId}/{dataType}/{date}/
	// +kubebuilder:validation:Optional
	StoragePath string `json:"storagePath,omitempty"`

	// Size is the total size of the dataset in bytes
	// +kubebuilder:validation:Optional
	Size int64 `json:"size,omitempty"`

	// FileCount is the number of files in the dataset
	// +kubebuilder:validation:Optional
	FileCount int32 `json:"fileCount,omitempty"`

	// Tags are custom labels for the dataset
	// +kubebuilder:validation:Optional
	Tags map[string]string `json:"tags,omitempty"`
}

// RLDatasetStatus defines the observed state of RLDataset
type RLDatasetStatus struct {
	// Phase represents the current phase of the dataset (Pending, Ready, Error)
	// +kubebuilder:validation:Enum=Pending;Ready;Error
	Phase string `json:"phase,omitempty"`

	// MountedBy lists the environments currently mounting this dataset
	// +kubebuilder:validation:Optional
	MountedBy []string `json:"mountedBy,omitempty"`

	// LastModified is the timestamp of the last modification
	// +kubebuilder:validation:Optional
	LastModified *metav1.Time `json:"lastModified,omitempty"`

	// Message provides additional status information
	// +kubebuilder:validation:Optional
	Message string `json:"message,omitempty"`

	// Conditions represent the latest available observations of the dataset's state
	// +kubebuilder:validation:Optional
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:resource:shortName=rlds
//+kubebuilder:printcolumn:name="ExperimentID",type=string,JSONPath=`.spec.experimentId`
//+kubebuilder:printcolumn:name="DataType",type=string,JSONPath=`.spec.dataType`
//+kubebuilder:printcolumn:name="Size",type=integer,JSONPath=`.spec.size`
//+kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
//+kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`

// RLDataset is the Schema for the rldatasets API
type RLDataset struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   RLDatasetSpec   `json:"spec,omitempty"`
	Status RLDatasetStatus `json:"status,omitempty"`
}

//+kubebuilder:object:root=true

// RLDatasetList contains a list of RLDataset
type RLDatasetList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []RLDataset `json:"items"`
}

func init() {
	SchemeBuilder.Register(&RLDataset{}, &RLDatasetList{})
}